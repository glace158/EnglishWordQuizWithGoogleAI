
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Word, QuizMode, SelectionMode, QuizState, VoiceName } from '../types';
import { speakText, generateAISentence, generateAIDictationSentence, generateDETTask, evaluateTranslation, evaluateDictation, evaluateDETResponse, getRemainingQuota } from '../services/geminiService';

export const useQuiz = (
  words: Word[], 
  setWords: React.Dispatch<React.SetStateAction<Word[]>>, 
  selectedVoice: VoiceName
) => {
  const [quizMode, setQuizMode] = useState<QuizMode>(QuizMode.KR_TO_EN);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(SelectionMode.RANDOM);
  const [excludeMastered, setExcludeMastered] = useState(false);
  const [lastWordId, setLastWordId] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState(getRemainingQuota());
  
  const initialQuizState: QuizState = {
    currentWord: null, userInput: '', isSubmitted: false, isCorrect: false, showHint: false, message: '', isSpeaking: false, isListening: false, isAiLoading: false, showModelAnswer: false, timerSeconds: 0, isTimerActive: false
  };
  const [state, setState] = useState<QuizState>(initialQuizState);
  const timerRef = useRef<any>(null);

  const [matchPool, setMatchPool] = useState<Word[]>([]);
  const [selectedKrId, setSelectedKrId] = useState<string | null>(null);
  const [selectedEnId, setSelectedEnId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  const refreshQuota = useCallback(() => {
    setRemainingQuota(getRemainingQuota());
  }, []);

  const recognition = useMemo(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    return rec;
  }, []);

  const startListening = useCallback(() => {
    if (!recognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }
    setState(prev => ({ ...prev, isListening: true }));
    recognition.start();

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        setState(prev => ({ ...prev, userInput: prev.userInput + finalTranscript }));
      }
    };

    recognition.onerror = () => setState(prev => ({ ...prev, isListening: false }));
    recognition.onend = () => setState(prev => ({ ...prev, isListening: false }));
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setState(prev => ({ ...prev, isListening: false }));
    }
  }, [recognition]);

  const generateMatchPool = useCallback(() => {
    const unmastered = words.filter(w => !w.isMastered);
    const source = (excludeMastered && unmastered.length > 0) ? unmastered : words;
    if (source.length === 0) return;
    const pool = [...source].sort(() => Math.random() - 0.5).slice(0, 5);
    setMatchPool(pool);
    setMatchedIds(new Set());
    setSelectedKrId(null); setSelectedEnId(null);
    setErrorIds(new Set());
  }, [words, excludeMastered]);

  const startTimer = useCallback((seconds: number) => {
    setState(prev => ({ ...prev, timerSeconds: seconds, isTimerActive: true }));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.timerSeconds && prev.timerSeconds > 0) {
          return { ...prev, timerSeconds: prev.timerSeconds - 1 };
        } else {
          clearInterval(timerRef.current);
          return { ...prev, isTimerActive: false };
        }
      });
    }, 1000);
  }, []);

  const getNextWord = useCallback(async (forcedMode?: any) => {
    const activeMode = (forcedMode && typeof forcedMode === 'string') ? forcedMode : quizMode;
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (timerRef.current) clearInterval(timerRef.current);

    if (activeMode === QuizMode.WORD_MATCH) {
      generateMatchPool();
      setState(initialQuizState);
      return;
    }

    const isDetMode = activeMode === QuizMode.DET_SPEAKING || activeMode === QuizMode.DET_WRITING;

    if (words.length === 0 && !isDetMode) return;
    const now = Date.now();
    const unmastered = words.filter(w => !w.isMastered);
    const pool = (excludeMastered && unmastered.length > 0) ? unmastered : words;
    
    let next: Word | null = null;
    if (!isDetMode) {
      if (pool.length === 0) return;
      if (selectionMode === SelectionMode.ORDERED) {
        const currentIndex = state.currentWord ? words.findIndex(w => w.id === state.currentWord?.id) : -1;
        let nextIndex = (currentIndex + 1) % words.length;
        let attempts = 0;
        while (excludeMastered && words[nextIndex]?.isMastered && attempts < words.length) {
          nextIndex = (nextIndex + 1) % words.length;
          attempts++;
        }
        next = words[nextIndex];
      } else {
        const randomPool = pool.flatMap(w => {
          let weight = Math.max(1, w.incorrectCount - w.correctCount + 5);
          if (w.nextReview <= now) weight += 3;
          return Array(weight).fill(w);
        });
        let filteredPool = randomPool;
        if (pool.length > 1 && lastWordId) {
          const tempPool = randomPool.filter(w => w.id !== lastWordId);
          if (tempPool.length > 0) filteredPool = tempPool;
        }
        next = filteredPool[Math.floor(Math.random() * filteredPool.length)];
      }
      setLastWordId(next.id);
    }

    if (activeMode === QuizMode.AI_SENTENCE_GEN && next) {
      setState({ ...initialQuizState, currentWord: next, isAiLoading: true });
      const sentence = await generateAISentence(next.en, next.kr);
      refreshQuota();
      setState(prev => ({ ...prev, aiContextSentence: sentence, isAiLoading: false }));
    } else if (activeMode === QuizMode.AI_DICTATION && next) {
      setState({ ...initialQuizState, currentWord: next, isAiLoading: true });
      const sentence = await generateAIDictationSentence(next.en);
      refreshQuota();
      setState(prev => ({ ...prev, aiDictationSentence: sentence, isAiLoading: false }));
      setTimeout(() => {
        speakText(sentence, selectedVoice).catch(err => console.error("Auto-play failed:", err));
      }, 150);
    } else if (isDetMode) {
      setState({ ...initialQuizState, currentWord: null, isAiLoading: true });
      const type = activeMode === QuizMode.DET_SPEAKING ? 'SPEAKING' : 'WRITING';
      const detTask = await generateDETTask(type);
      refreshQuota();
      setState(prev => ({ ...prev, detTask, isAiLoading: false }));
      const duration = activeMode === QuizMode.DET_SPEAKING ? 180 : 300;
      startTimer(duration);
    } else if (next) {
      setState({ ...initialQuizState, currentWord: next });
    }
  }, [words, quizMode, selectionMode, excludeMastered, state.currentWord, generateMatchPool, lastWordId, refreshQuota, selectedVoice, startTimer]);

  useEffect(() => {
    const isDetMode = quizMode === QuizMode.DET_SPEAKING || quizMode === QuizMode.DET_WRITING;
    if (words.length > 0 || isDetMode) {
      if (quizMode === QuizMode.WORD_MATCH) {
        if (matchPool.length === 0) generateMatchPool();
      } else {
        if (!state.currentWord && !state.detTask) getNextWord();
      }
    }
  }, [words, state.currentWord, state.detTask, quizMode, getNextWord, generateMatchPool, matchPool.length]);

  const handleSubmit = useCallback(async () => {
    const isDetMode = quizMode === QuizMode.DET_SPEAKING || quizMode === QuizMode.DET_WRITING;
    if ((!state.currentWord && !isDetMode) || state.isSubmitted || !state.userInput.trim() || state.isAiLoading) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    if (state.isListening) stopListening();

    const input = state.userInput.trim();
    let isCorrect = false;
    let aiFeedback = "";
    let detFeedbackData = undefined;

    if (quizMode === QuizMode.AI_SENTENCE_GEN && state.currentWord) {
      setState(prev => ({ ...prev, isAiLoading: true }));
      const evaluation = await evaluateTranslation(
        state.currentWord.en, 
        state.currentWord.kr, 
        state.aiContextSentence || "", 
        state.userInput
      );
      refreshQuota();
      isCorrect = evaluation.isCorrect;
      aiFeedback = evaluation.feedback;
    } else if (quizMode === QuizMode.AI_DICTATION) {
      const normalize = (s: string) => s.toLowerCase().replace(/[.,!?;:]/g, '').trim();
      const original = state.aiDictationSentence || "";
      isCorrect = normalize(input) === normalize(original);
      aiFeedback = ""; 
    } else if (quizMode === QuizMode.KR_TO_EN && state.currentWord) {
      isCorrect = input.toLowerCase() === state.currentWord.en.toLowerCase();
    } else if (quizMode === QuizMode.EN_TO_KR && state.currentWord) {
      isCorrect = state.currentWord.kr.split(/[,/]/).some(m => 
        m.trim().toLowerCase() === input.toLowerCase() || m.trim().toLowerCase().includes(input.toLowerCase())
      );
    } else if (quizMode === QuizMode.EXAMPLE_GAP && state.currentWord) {
      isCorrect = input.toLowerCase() === state.currentWord.en.toLowerCase();
    } else if (isDetMode) {
      setState(prev => ({ ...prev, isAiLoading: true }));
      const type = quizMode === QuizMode.DET_SPEAKING ? 'SPEAKING' : 'WRITING';
      detFeedbackData = await evaluateDETResponse(type, state.detTask?.task || "", state.userInput);
      refreshQuota();
      isCorrect = true;
    }

    if (![QuizMode.AI_DICTATION, QuizMode.DET_SPEAKING, QuizMode.DET_WRITING].includes(quizMode) && state.currentWord) {
      setWords(prev => prev.map(w => {
        if (w.id !== state.currentWord?.id) return w;
        let nextRepetitions = isCorrect ? w.repetitions + 1 : 0;
        let nextEasiness = isCorrect ? Math.max(1.3, w.easiness + 0.1) : Math.max(1.3, w.easiness - 0.2);
        let nextInterval = 0;
        if (nextRepetitions === 1) nextInterval = 1;
        else if (nextRepetitions === 2) nextInterval = 6;
        else if (nextRepetitions > 2) nextInterval = Math.round(w.interval * nextEasiness);
        const nextReview = Date.now() + (nextInterval * 24 * 60 * 60 * 1000);
        return {
          ...w,
          correctCount: isCorrect ? w.correctCount + 1 : w.correctCount,
          incorrectCount: !isCorrect ? w.incorrectCount + 1 : w.incorrectCount,
          isMastered: (isCorrect ? w.correctCount + 1 : w.correctCount) >= 5,
          repetitions: nextRepetitions, easiness: nextEasiness, interval: nextInterval, nextReview: nextReview
        };
      }));
    }

    setState(prev => ({ ...prev, isSubmitted: true, isCorrect, aiFeedback, detFeedback: detFeedbackData, isAiLoading: false, isTimerActive: false }));
    
    if (!isDetMode && quizMode !== QuizMode.AI_DICTATION) {
      if (isCorrect && quizMode !== QuizMode.AI_SENTENCE_GEN && state.currentWord) {
        speakText(quizMode === QuizMode.EXAMPLE_GAP ? state.currentWord.example : state.currentWord.en, selectedVoice);
      } else if (quizMode === QuizMode.AI_SENTENCE_GEN) {
        speakText(state.userInput, selectedVoice);
      }
    }
  }, [state.currentWord, state.isSubmitted, state.userInput, state.aiContextSentence, state.aiDictationSentence, state.isAiLoading, state.isListening, state.detTask, quizMode, setWords, selectedVoice, refreshQuota, stopListening]);

  const handleMatchClick = useCallback((id: string, type: 'kr' | 'en') => {
    if (matchedIds.has(id)) return;
    if (type === 'kr') setSelectedKrId(id);
    else setSelectedEnId(id);
  }, [matchedIds]);

  const toggleCurrentMastery = useCallback(() => {
    if (!state.currentWord) return;
    const targetId = state.currentWord.id;
    const newStatus = !state.currentWord.isMastered;
    setWords(prev => prev.map(w => w.id === targetId ? { ...w, isMastered: newStatus } : w));
    setState(prev => ({ ...prev, currentWord: prev.currentWord ? { ...prev.currentWord, isMastered: newStatus } : null }));
  }, [state.currentWord, setWords]);

  useEffect(() => {
    if (selectedKrId && selectedEnId) {
      if (selectedKrId === selectedEnId) {
        setMatchedIds(prev => new Set(prev).add(selectedKrId));
        setSelectedKrId(null); setSelectedEnId(null);
        setWords(prev => prev.map(w => w.id === selectedKrId ? { ...w, correctCount: w.correctCount + 1 } : w));
        const wordObj = matchPool.find(w => w.id === selectedKrId);
        if (wordObj) speakText(wordObj.en, selectedVoice);
      } else {
        setErrorIds(new Set([selectedKrId, selectedEnId]));
        setTimeout(() => { setErrorIds(new Set()); setSelectedKrId(null); setSelectedEnId(null); }, 600);
      }
    }
  }, [selectedKrId, selectedEnId, matchPool, selectedVoice, setWords]);

  return useMemo(() => ({
    quizMode, setQuizMode, selectionMode, setSelectionMode, excludeMastered, setExcludeMastered, state, setState, 
    matchPool, getNextWord, handleSubmit, initialQuizState, handleMatchClick, matchedIds, selectedKrId, selectedEnId, errorIds, generateMatchPool,
    toggleCurrentMastery, startListening, stopListening, remainingQuota
  }), [quizMode, selectionMode, excludeMastered, state, matchPool, matchedIds, selectedKrId, selectedEnId, errorIds, getNextWord, handleSubmit, generateMatchPool, initialQuizState, handleMatchClick, toggleCurrentMastery, startListening, stopListening, remainingQuota]);
};
