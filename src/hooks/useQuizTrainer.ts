import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WordItem, QuizMode, OrderMode, isWeakWord } from '../types';
import { speakText } from '../utils/tts';

interface UseQuizTrainerProps {
  words: WordItem[];
  onWordsChange: (newWords: WordItem[]) => void;
  quizMode: QuizMode;
  orderMode: OrderMode;
  skipMastered: boolean;
  voiceName: string;
  isActive: boolean;
  startWordId?: string | null;
  setStartWordId?: (id: string | null) => void;
  weakThreshold?: number;
}

export function useQuizTrainer({
  words,
  onWordsChange,
  quizMode,
  orderMode,
  skipMastered,
  voiceName,
  isActive,
  startWordId,
  setStartWordId,
  weakThreshold = 80
}: UseQuizTrainerProps) {
  // Quiz execution-flow and answers state
  const [activeQueue, setActiveQueue] = useState<WordItem[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>('');
  
  // Evaluation step
  const [evaluationState, setEvaluationState] = useState<'IDLE' | 'CORRECT' | 'INCORRECT'>('IDLE');
  const [userAttemptsOnCurrentWord, setUserAttemptsOnCurrentWord] = useState<number>(0);
  const [sessionScore, setSessionScore] = useState<{ correct: number; attempts: number }>({ correct: 0, attempts: 0 });
  
  // Helpful hints
  const [hintLettersRevealed, setHintLettersRevealed] = useState<number>(0);

  // Focus reference
  const inputRef = useRef<HTMLInputElement>(null);

  // Construct active training queue based on preferences
  const rebuildQuizQueue = () => {
    let pool = [...words];
    
    // Filter mastered items if requested
    if (skipMastered) {
      pool = pool.filter(w => !w.mastered);
    }

    if (orderMode === 'WEAK_ONLY') {
      pool = pool.filter(w => isWeakWord(w, weakThreshold));
    }

    if (pool.length === 0) {
      setActiveQueue([]);
      setQueueIndex(0);
      setEvaluationState('IDLE');
      setInputValue('');
      return;
    }

    // Apply sorting/ordering logic
    if (orderMode === 'WEAK_ONLY' || orderMode === 'SHUFFLED') {
      // Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    } else if (orderMode === 'WEIGHTED') {
      // Sort in descending order based on calculated learning weight (priority for higher failure rates)
      pool.sort((a, b) => {
        const accuracyA = a.attempts > 0 ? (a.correctCount / a.attempts) * 100 : 0;
        const accuracyB = b.attempts > 0 ? (b.correctCount / b.attempts) * 105 : 0; // slight variance or priority
        
        // Items with 0 attempts get general mid-priority 50 weight
        const weightA = a.attempts === 0 ? 55 : (100 - accuracyA);
        const weightB = b.attempts === 0 ? 55 : (100 - accuracyB);
        
        return weightB - weightA; // higher weights first
      });
    }
    // 'ORDERED' keeps default deck sequence list

    setActiveQueue(pool);
    setQueueIndex(0);
    setEvaluationState('IDLE');
    setInputValue('');
    setHintLettersRevealed(0);
    setUserAttemptsOnCurrentWord(0);
  };

  // Re-trigger queue rebuild when key settings or deck contents change
  useEffect(() => {
    rebuildQuizQueue();
  }, [words.length, orderMode, skipMastered, quizMode, weakThreshold]);

  // Jump to specific word in queue if startWordId is provided
  useEffect(() => {
    if (isActive && startWordId && activeQueue.length > 0) {
      const idx = activeQueue.findIndex(w => w.id === startWordId);
      if (idx !== -1) {
        setQueueIndex(idx);
        setEvaluationState('IDLE');
        setInputValue('');
        setHintLettersRevealed(0);
        setUserAttemptsOnCurrentWord(0);
      }
      setStartWordId?.(null);
    }
  }, [startWordId, activeQueue, isActive, setStartWordId]);

  // Selected random sentence index for the current card (if there are multiple)
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number>(0);

  // When currentWord id or queueIndex (or quizMode) changes, or currentWord is loaded, pick a stable random index
  const currentWordId = activeQueue[queueIndex]?.id || null;
  useEffect(() => {
    const activeWord = activeQueue[queueIndex];
    if (activeWord?.sentence) {
      const sentences = activeWord.sentence.split(';').map(s => s.trim()).filter(Boolean);
      if (sentences.length > 1) {
        setSelectedSentenceIndex(Math.floor(Math.random() * sentences.length));
      } else {
        setSelectedSentenceIndex(0);
      }
    } else {
      setSelectedSentenceIndex(0);
    }
  }, [currentWordId, queueIndex, quizMode]);

  // Current active word entry helper
  const currentWord = useMemo<WordItem | null>(() => {
    if (activeQueue.length > 0 && queueIndex < activeQueue.length) {
      const baseWord = activeQueue[queueIndex];
      const meaningFormatted = baseWord.meaning 
        ? baseWord.meaning.split(';').map(m => m.trim()).filter(Boolean).join(', ') 
        : '';

      if (baseWord.sentence) {
        const sentences = baseWord.sentence.split(';').map(s => s.trim()).filter(Boolean);
        const translations = baseWord.sentence_translation ? baseWord.sentence_translation.split(';').map(t => t.trim()).filter(Boolean) : [];
        
        // Pick the stable randomly selected index
        const sIndex = selectedSentenceIndex < sentences.length ? selectedSentenceIndex : 0;
        const chosenSentence = sentences[sIndex] || '';
        const chosenTranslation = translations[sIndex] || translations[0] || '';
        
        return {
          ...baseWord,
          meaning: meaningFormatted,
          sentence: chosenSentence,
          sentence_translation: chosenTranslation
        };
      }
      return {
        ...baseWord,
        meaning: meaningFormatted
      };
    }
    return null;
  }, [activeQueue, queueIndex, selectedSentenceIndex]);

  // Read aloud helper for current word/sentence
  const playCurrentTts = () => {
    if (!currentWord) return;
    if (quizMode === 'SENT_BLANK' && currentWord.sentence) {
      speakText(currentWord.sentence, voiceName);
    } else {
      speakText(currentWord.word, voiceName);
    }
  };

  // Auto focus input on card navigation
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive, queueIndex, quizMode, evaluationState]);

  // Helper matching formula checking answers
  const checkAnswerCore = () => {
    if (!currentWord) return;

    const rawInput = inputValue.trim();
    if (!rawInput) return;

    let isCorrect = false;

    if (quizMode === 'KR_EN' || quizMode === 'SENT_BLANK' || quizMode === 'HEAR') {
      // English spelling matches - exact, case-insensitive, ignores trailing punct/spaces
      const standardInput = rawInput.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const standardTarget = currentWord.word.toLowerCase().replace(/[^a-z0-9]/gi, '');
      isCorrect = standardInput === standardTarget;
    } else if (quizMode === 'EN_KR') {
      // Korean synonym matcher
      const cleanInput = rawInput.replace(/\s+/g, '').replace(/^~|~$/, '').toLowerCase();
      
      // Split target Korean synonyms by commas or semi-colons
      const targetSynonyms = currentWord.meaning
        .split(/[;,~]+/)
        .map(term => term.replace(/\s+/g, '').replace(/^~|~$/, '').toLowerCase())
        .filter(term => term.length > 0);
        
      const cleanTargetWhole = currentWord.meaning.replace(/\s+/g, '').replace(/^~|~$/, '').toLowerCase();

      isCorrect = targetSynonyms.includes(cleanInput) || cleanInput === cleanTargetWhole;
    }

    if (isCorrect) {
      // Set correct state
      setEvaluationState('CORRECT');
      speakText(currentWord.word, voiceName); // Read immediately on correct answer as requested!

      // Log attempts & accuracy securely in database state
      const updatedWords = words.map(w => {
        if (w.id === currentWord.id) {
          const newAttempts = (w.attempts || 0) + 1;
          const newCorrect = (w.correctCount || 0) + 1;
          return {
            ...w,
            attempts: newAttempts,
            correctCount: newCorrect,
            // Automatically mark mastered if correct on first trial 3 consecutive times or more
            mastered: w.mastered || (newCorrect >= 3 && newCorrect === newAttempts)
          };
        }
        return w;
      });
      onWordsChange(updatedWords);
      setActiveQueue(prev => prev.map(w => {
        if (w.id === currentWord.id) {
          const newAttempts = (w.attempts || 0) + 1;
          const newCorrect = (w.correctCount || 0) + 1;
          return {
            ...w,
            attempts: newAttempts,
            correctCount: newCorrect,
            mastered: w.mastered || (newCorrect >= 3 && newCorrect === newAttempts)
          };
        }
        return w;
      }));
      setSessionScore(prev => ({ correct: prev.correct + 1, attempts: prev.attempts + 1 }));

    } else {
      // Incorrect answer handling
      setEvaluationState('INCORRECT');
      setUserAttemptsOnCurrentWord(p => p + 1);

      // Increment words attempts internally, correctness rate drops
      const updatedWords = words.map(w => {
        if (w.id === currentWord.id) {
          return {
            ...w,
            attempts: (w.attempts || 0) + 1
          };
        }
        return w;
      });
      onWordsChange(updatedWords);
      setActiveQueue(prev => prev.map(w => {
        if (w.id === currentWord.id) {
          return {
            ...w,
            attempts: (w.attempts || 0) + 1
          };
        }
        return w;
      }));
      setSessionScore(prev => ({ ...prev, attempts: prev.attempts + 1 }));
    }
  };

  // Skip current question
  const handleSkipToNext = () => {
    setInputValue('');
    setEvaluationState('IDLE');
    setHintLettersRevealed(0);
    setUserAttemptsOnCurrentWord(0);

    if (queueIndex < activeQueue.length - 1) {
      setQueueIndex(prev => prev + 1);
    } else {
      // Loop or congratulate
      setQueueIndex(0);
      rebuildQuizQueue();
    }
  };

  // Retry currently incorrect word
  const handleRetryCurrentWord = () => {
    setEvaluationState('IDLE');
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Input actions (Enter / Keybind triggers)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (evaluationState === 'IDLE') {
        checkAnswerCore();
      } else if (evaluationState === 'CORRECT') {
        handleSkipToNext();
      } else if (evaluationState === 'INCORRECT') {
        handleSkipToNext();
      }
    } else if (e.key === 'Backspace' && (evaluationState === 'INCORRECT' || evaluationState === 'CORRECT')) {
      e.preventDefault();
      handleRetryCurrentWord();
    }
  };

  // Change Mastered status of currently active target word directly
  const handleToggleCurrentMastered = () => {
    if (!currentWord) return;
    const nextStatus = !currentWord.mastered;
    const updated = words.map(w => {
      if (w.id === currentWord.id) {
        return { ...w, mastered: nextStatus };
      }
      return w;
    });
    onWordsChange(updated);
    setActiveQueue(prev => prev.map(w => {
      if (w.id === currentWord.id) {
        return { ...w, mastered: nextStatus };
      }
      return w;
    }));
  };

  // Listen to global keys for shortcuts: Ctrl for clue, Alt+M for mastered, Alt+S for speech
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isActive || !currentWord) return;
      
      const keyUpper = e.key.toUpperCase();
      
      if (e.key === 'Control') {
        if (quizMode !== 'EN_KR') {
          e.preventDefault();
          setHintLettersRevealed(prev => Math.min(prev + 1, currentWord.word.length));
        }
      } else if (e.altKey && keyUpper === 'M') {
        e.preventDefault();
        handleToggleCurrentMastered();
      } else if (e.altKey && keyUpper === 'S') {
        e.preventDefault();
        playCurrentTts();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isActive, quizMode, currentWord, words, voiceName]);

  // Generate word character reveals/letter clues
  const getSpellingClue = () => {
    if (!currentWord) return '';
    const word = currentWord.word;
    if (hintLettersRevealed === 0) return 'Click Clue';
    
    let clue = '';
    for (let i = 0; i < word.length; i++) {
      if (i < hintLettersRevealed) {
        clue += word[i];
      } else if (word[i] === ' ') {
        clue += ' ';
      } else {
        clue += '•';
      }
    }
    return clue;
  };

  // Format English sentence with blanked targets (Mode 3: SENT_BLANK)
  const getMaskedSentence = (sentence: string, targetWord: string): string => {
    if (!sentence) return '';
    const wordClean = targetWord.trim().toLowerCase();
    
    // Find matching letters/words boundaries safely and wrap with a sleek highlighted blanks
    const escapedWord = wordClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}[a-z]*\\b`, 'gi');
    
    return sentence.replace(regex, (match) => {
      if (match.length > 0) {
        return match[0] + '________';
      }
      return '_________';
    });
  };

  // Get dynamic placeholder depending on game rules
  const getPlaceholderText = () => {
    if (evaluationState === 'CORRECT') return 'Correct! Press Enter to proceed...';
    if (evaluationState === 'INCORRECT') return 'Incorrect...';
    
    switch(quizMode) {
      case 'KR_EN': return 'Type English translation...';
      case 'EN_KR': return '한글 뜻을 입력하세요 (예: 뜻을 입력 후 엔터)...';
      case 'SENT_BLANK': return 'Type the missing English word...';
      case 'HEAR': return 'Type what you hear...';
      default: return 'Type translation...';
    }
  };

  // Select error rate rating for currently viewed word index
  const currentWordErrorRate = useMemo<number>(() => {
    if (!currentWord) return 0;
    if (!currentWord.attempts) return 0;
    return Math.round(( (currentWord.attempts - currentWord.correctCount) / currentWord.attempts ) * 100);
  }, [currentWord]);

  return {
    activeQueue,
    queueIndex,
    setQueueIndex,
    inputValue,
    setInputValue,
    evaluationState,
    sessionScore,
    hintLettersRevealed,
    setHintLettersRevealed,
    inputRef,
    currentWord,
    playCurrentTts,
    checkAnswerCore,
    handleSkipToNext,
    handleRetryCurrentWord,
    handleKeyDown,
    handleToggleCurrentMastered,
    getSpellingClue,
    getMaskedSentence,
    getPlaceholderText,
    currentWordErrorRate,
    rebuildQuizQueue
  };
}
