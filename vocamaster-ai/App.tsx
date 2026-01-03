
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Word, QuizMode, SelectionMode, QuizState, VoiceName } from './types';
import { INITIAL_WORDS } from './constants';
import { speakText, getSystemVoices } from './services/geminiService';

const App: React.FC = () => {
  const [words, setWords] = useState<Word[]>(() => {
    const saved = localStorage.getItem('voca_words');
    if (saved === null) return INITIAL_WORDS;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : INITIAL_WORDS;
    } catch (e) {
      return INITIAL_WORDS;
    }
  });

  const [quizMode, setQuizMode] = useState<QuizMode>(QuizMode.KR_TO_EN);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(SelectionMode.ORDERED);
  const [excludeMastered, setExcludeMastered] = useState(false);
  const [activeTab, setActiveTab] = useState<'quiz' | 'list'>('quiz');
  
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(() => {
    return localStorage.getItem('voca_native_voice') || '';
  });
  
  const initialQuizState: QuizState = {
    currentWord: null,
    userInput: '',
    isSubmitted: false,
    isCorrect: false,
    showHint: false,
    message: '',
    isSpeaking: false
  };

  const [state, setState] = useState<QuizState>(initialQuizState);

  // --- Word Matching Specific State ---
  const [matchPool, setMatchPool] = useState<Word[]>([]);
  const [selectedKrId, setSelectedKrId] = useState<string | null>(null);
  const [selectedEnId, setSelectedEnId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadVoices = () => {
      const voices = getSystemVoices();
      setAvailableVoices(voices);
      if (!selectedVoice && voices.length > 0) {
        const preferred = voices.find(v => v.lang === 'en-US' || v.name.includes('Google US English')) || voices[0];
        setSelectedVoice(preferred.name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [selectedVoice]);

  useEffect(() => {
    localStorage.setItem('voca_words', JSON.stringify(words));
  }, [words]);

  useEffect(() => {
    if (selectedVoice) {
      localStorage.setItem('voca_native_voice', selectedVoice);
    }
  }, [selectedVoice]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const generateMatchPool = useCallback(() => {
    const filtered = excludeMastered ? words.filter(w => !w.isMastered) : words;
    if (filtered.length === 0) return;
    
    // Select up to 5 random words for the matching game
    const poolSize = Math.min(5, filtered.length);
    const shuffledPool = shuffleArray(filtered).slice(0, poolSize);
    setMatchPool(shuffledPool);
    setMatchedIds(new Set());
    setSelectedKrId(null);
    setSelectedEnId(null);
    setErrorIds(new Set());
  }, [words, excludeMastered]);

  const getNextWord = useCallback(() => {
    if (quizMode === QuizMode.WORD_MATCH) {
      generateMatchPool();
      setState(initialQuizState);
      return;
    }

    const filteredWords = excludeMastered 
      ? words.filter(w => !w.isMastered) 
      : words;

    if (filteredWords.length === 0) {
      setState(prev => ({ 
        ...initialQuizState, 
        message: words.length === 0 ? '단어 목록이 비어있습니다. 단어를 추가해주세요!' : '학습할 단어가 없습니다!' 
      }));
      return;
    }

    let next: Word;

    if (selectionMode === SelectionMode.ORDERED) {
      const currentIndex = state.currentWord ? words.findIndex(w => w.id === state.currentWord?.id) : -1;
      let nextIndex = (currentIndex + 1) % words.length;
      
      if (excludeMastered) {
        let attempts = 0;
        while (words[nextIndex].isMastered && attempts < words.length) {
          nextIndex = (nextIndex + 1) % words.length;
          attempts++;
        }
      }
      next = words[nextIndex];
    } else {
      const pool = filteredWords.map(w => ({
        word: w,
        weight: (w.incorrectCount + 1) / (w.correctCount + 1)
      }));

      const totalWeight = pool.reduce((acc, p) => acc + p.weight, 0);
      let random = Math.random() * totalWeight;
      
      let selected = pool[0].word;
      for (const item of pool) {
        if (random < item.weight) {
          selected = item.word;
          break;
        }
        random -= item.weight;
      }
      next = selected;
    }

    setState({
      ...initialQuizState,
      currentWord: next,
    });
    
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [words, selectionMode, excludeMastered, state.currentWord, quizMode, generateMatchPool]);

  useEffect(() => {
    if (quizMode === QuizMode.WORD_MATCH) {
      if (matchPool.length === 0 && words.length > 0) {
        generateMatchPool();
      }
    } else {
      if (!state.currentWord && activeTab === 'quiz' && words.length > 0 && !state.message) {
        getNextWord();
      }
    }
  }, [getNextWord, state.currentWord, activeTab, words.length, state.message, quizMode, matchPool.length, generateMatchPool]);

  const handleSubmit = async () => {
    if (!state.currentWord || state.isSubmitted || !state.userInput.trim()) return;

    let isCorrect = false;
    const input = state.userInput.trim().toLowerCase();

    if (quizMode === QuizMode.KR_TO_EN) {
      isCorrect = input === state.currentWord.en.toLowerCase();
    } else if (quizMode === QuizMode.EN_TO_KR) {
      const correctMeanings = state.currentWord.kr.split(/[,/]/).map(m => m.trim().toLowerCase());
      isCorrect = correctMeanings.some(m => input.includes(m) || m.includes(input));
    } else if (quizMode === QuizMode.EXAMPLE_GAP) {
      isCorrect = input === state.currentWord.en.toLowerCase();
    }

    setWords(prev => {
      return prev.map(w => {
        if (w.id === state.currentWord?.id) {
          const newCorrect = isCorrect ? w.correctCount + 1 : w.correctCount;
          const newIncorrect = !isCorrect ? w.incorrectCount + 1 : w.incorrectCount;
          const updatedWord = {
            ...w,
            correctCount: newCorrect,
            incorrectCount: newIncorrect,
            isMastered: newCorrect >= 5 && (newCorrect / (newCorrect + newIncorrect)) > 0.8
          };
          setState(prev => ({ ...prev, isSubmitted: true, isCorrect, currentWord: updatedWord }));
          return updatedWord;
        }
        return w;
      });
    });

    if (isCorrect) {
      setState(prev => ({ ...prev, isSpeaking: true }));
      try {
        const textToSpeak = quizMode === QuizMode.EXAMPLE_GAP ? state.currentWord.example : state.currentWord.en;
        await speakText(textToSpeak, selectedVoice);
      } catch (e) {
        console.error("Audio Error:", e);
      } finally {
        setState(prev => ({ ...prev, isSpeaking: false }));
      }
    }
  };

  const handleNext = () => getNextWord();
  const handleRetry = () => {
    setState(prev => ({ ...prev, userInput: '', isSubmitted: false, isCorrect: false, showHint: false }));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const startFromWord = (word: Word) => {
    setState({
      ...initialQuizState,
      currentWord: word,
    });
    setSelectionMode(SelectionMode.ORDERED);
    setActiveTab('quiz');
    if(quizMode === QuizMode.WORD_MATCH) setQuizMode(QuizMode.KR_TO_EN);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // --- Word Match Interaction ---
  const handleMatchClick = (id: string, type: 'kr' | 'en') => {
    if (matchedIds.has(id)) return;

    if (type === 'kr') {
      if (selectedKrId === id) setSelectedKrId(null);
      else setSelectedKrId(id);
    } else {
      if (selectedEnId === id) setSelectedEnId(null);
      else setSelectedEnId(id);
    }
  };

  useEffect(() => {
    if (selectedKrId && selectedEnId) {
      if (selectedKrId === selectedEnId) {
        // Correct
        const newMatched = new Set(matchedIds);
        newMatched.add(selectedKrId);
        setMatchedIds(newMatched);
        setSelectedKrId(null);
        setSelectedEnId(null);

        // Update counts
        setWords(prev => prev.map(w => w.id === selectedKrId ? { ...w, correctCount: w.correctCount + 1 } : w));
        
        // Speak word
        const wordObj = matchPool.find(w => w.id === selectedKrId);
        if (wordObj) speakText(wordObj.en, selectedVoice);

      } else {
        // Incorrect
        const currentKr = selectedKrId;
        const currentEn = selectedEnId;
        setErrorIds(new Set([currentKr, currentEn]));
        
        setTimeout(() => {
          setErrorIds(new Set());
          setSelectedKrId(null);
          setSelectedEnId(null);
        }, 600);
      }
    }
  }, [selectedKrId, selectedEnId, matchedIds, matchPool, selectedVoice]);

  const shuffledKr = useMemo(() => shuffleArray(matchPool), [matchPool]);
  const shuffledEn = useMemo(() => shuffleArray(matchPool), [matchPool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'quiz') return;
      if (e.key === 'Enter') {
        if (state.isSubmitted) handleNext();
        else if (quizMode !== QuizMode.WORD_MATCH) handleSubmit();
      } else if (e.key === 'Backspace' && state.isSubmitted) {
        handleRetry();
      } else if (e.key === 'Control') {
        if (quizMode === QuizMode.EXAMPLE_GAP) {
          setState(prev => ({ ...prev, showHint: !prev.showHint }));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isSubmitted, state.currentWord, state.userInput, quizMode, activeTab]);

  const toggleMastered = (id: string) => {
    setWords(prev => {
      const newWords = prev.map(w => w.id === id ? { ...w, isMastered: !w.isMastered } : w);
      if (state.currentWord?.id === id) {
        const updated = newWords.find(w => w.id === id);
        if (updated) setState(prev => ({ ...prev, currentWord: updated }));
      }
      return newWords;
    });
  };

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);
    for (let line of lines) {
      if (!line.trim()) continue;
      const parts = [];
      let currentPart = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(currentPart.trim());
          currentPart = "";
        } else {
          currentPart += char;
        }
      }
      parts.push(currentPart.trim());
      rows.push(parts);
    }
    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsedData = parseCSV(content);
      if (parsedData.length === 0) return;

      const firstRowFirstCol = parsedData[0][0]?.toLowerCase() || '';
      const startIndex = (firstRowFirstCol === 'word' || firstRowFirstCol === '영단어' || firstRowFirstCol === 'english') ? 1 : 0;
      
      const newWordsFromCSV: Word[] = parsedData.slice(startIndex).map((row, idx) => {
        const clean = (val: string | undefined) => (val || '').replace(/[;/]/g, ',');
        return {
          id: `csv-${Date.now()}-${idx}`,
          en: clean(row[0]).trim(),
          kr: clean(row[1]).trim(),
          example: clean(row[2]).trim(),
          exampleKr: clean(row[3]).trim(),
          correctCount: 0,
          incorrectCount: 0,
          isMastered: false
        };
      }).filter(w => w.en && w.kr);

      setWords(prev => {
        const existingEnWords = new Set(prev.map(w => w.en.toLowerCase()));
        const uniqueNewWords: Word[] = [];
        const seenInCSV = new Set<string>();

        for (const w of newWordsFromCSV) {
          const lowerEn = w.en.toLowerCase();
          if (!existingEnWords.has(lowerEn) && !seenInCSV.has(lowerEn)) {
            uniqueNewWords.push(w);
            seenInCSV.add(lowerEn);
          }
        }

        if (uniqueNewWords.length === 0) {
          alert('추가할 새로운 단어가 없거나 이미 모두 등록되어 있습니다.');
          return prev;
        }

        alert(`${uniqueNewWords.length}개의 새로운 단어를 성공적으로 가져왔습니다.`);
        setState(initialQuizState); 
        return [...prev, ...uniqueNewWords];
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getQuestionText = () => {
    if (!state.currentWord) return '';
    if (quizMode === QuizMode.KR_TO_EN) return state.currentWord.kr;
    if (quizMode === QuizMode.EN_TO_KR) return state.currentWord.en;
    if (quizMode === QuizMode.EXAMPLE_GAP) {
      const word = state.currentWord.en;
      const firstChar = word.charAt(0);
      const mask = `${firstChar}${' _'.repeat(word.length - 1)}`;
      return state.currentWord.example.replace(new RegExp(word, 'gi'), mask);
    }
    return '';
  };

  const calculateAccuracy = (word: Word) => {
    const total = word.correctCount + word.incorrectCount;
    return total === 0 ? 0 : Math.round((word.correctCount / total) * 100);
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100 flex flex-col items-center py-10 px-4">
      <div className="max-w-4xl w-full">
        <header className="mb-12 text-center">
          <h1 className="text-5xl font-extrabold mb-3 tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400">
              VocaMaster AI
            </span>
          </h1>
          <p className="text-slate-500 font-medium italic">Native System Voices enabled - No Quota</p>
          
          <div className="mt-10 flex justify-center p-1 bg-[#11141b] rounded-full w-fit mx-auto shadow-2xl border border-slate-800">
            <button 
              onClick={() => setActiveTab('quiz')}
              className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === 'quiz' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Trivia Showdown
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === 'list' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Word Studio
            </button>
          </div>
        </header>

        {activeTab === 'quiz' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { mode: QuizMode.KR_TO_EN, title: 'KR ➔ EN', desc: 'Recall English' },
                { mode: QuizMode.EN_TO_KR, title: 'EN ➔ KR', desc: 'Recall Meaning' },
                { mode: QuizMode.EXAMPLE_GAP, title: 'Sentence', desc: 'Fill the Gaps' },
                { mode: QuizMode.WORD_MATCH, title: 'Match', desc: 'Pair Meanings' }
              ].map(item => (
                <button 
                  key={item.mode}
                  onClick={() => { setQuizMode(item.mode); setState(initialQuizState); if(item.mode === QuizMode.WORD_MATCH) generateMatchPool(); }}
                  className={`group relative p-4 rounded-2xl border transition-all duration-300 ${quizMode === item.mode ? 'bg-[#1a1c24] border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-[#0e1117] border-slate-800 hover:border-slate-700'}`}
                >
                  <div className={`font-black text-lg ${quizMode === item.mode ? 'text-purple-400' : 'text-slate-400'}`}>{item.title}</div>
                  <div className="text-[10px] uppercase tracking-widest font-bold opacity-50 mt-1">{item.desc}</div>
                  {quizMode === item.mode && <div className="absolute bottom-0 left-0 h-1 bg-purple-500 rounded-full w-full"></div>}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between bg-[#0e1117] p-5 rounded-2xl border border-slate-800 shadow-xl">
              <div className="flex gap-3 items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Method</span>
                <div className="flex bg-[#080a0f] p-1 rounded-lg">
                  <button onClick={() => { setSelectionMode(SelectionMode.ORDERED); setState(initialQuizState); }} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${selectionMode === SelectionMode.ORDERED ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Ordered</button>
                  <button onClick={() => { setSelectionMode(SelectionMode.RANDOM); setState(initialQuizState); }} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${selectionMode === SelectionMode.RANDOM ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Weighted</button>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Native Voice</span>
                  <select 
                    value={selectedVoice} 
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="bg-[#080a0f] border border-slate-800 text-xs rounded-xl focus:ring-purple-500 p-2.5 text-slate-300 font-bold outline-none max-w-[200px]"
                  >
                    {availableVoices.length > 0 ? availableVoices.map(v => <option key={v.name} value={v.name}>{v.name}</option>) : <option>Loading Voices...</option>}
                  </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={excludeMastered} onChange={(e) => { setExcludeMastered(e.target.checked); setState(initialQuizState); }} className="w-5 h-5 rounded-lg border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500" />
                  <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300 transition uppercase tracking-wider">Skip Mastered</span>
                </label>
              </div>
            </div>

            <div className="bg-[#11141b] p-6 md:p-12 rounded-[2.5rem] shadow-2xl border border-slate-800/50 min-h-[450px] flex flex-col relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-indigo-500/5 pointer-events-none"></div>
              
              {quizMode === QuizMode.WORD_MATCH ? (
                <div className="flex-1 flex flex-col items-center justify-center z-10 w-full">
                  <h3 className="text-xl font-bold mb-8 text-slate-400 uppercase tracking-widest">Match the Pairs</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 w-full max-w-2xl">
                    <div className="flex flex-col gap-4">
                      {shuffledKr.map(word => {
                        const isMatched = matchedIds.has(word.id);
                        const isSelected = selectedKrId === word.id;
                        const isError = errorIds.has(word.id);
                        return (
                          <button
                            key={`kr-${word.id}`}
                            disabled={isMatched}
                            onClick={() => handleMatchClick(word.id, 'kr')}
                            className={`p-5 rounded-2xl border-2 transition-all duration-300 font-bold text-sm md:text-base h-20 flex items-center justify-center text-center
                              ${isMatched ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500/50' : 
                                isError ? 'bg-rose-500/20 border-rose-500 animate-[shake_0.4s_ease-in-out]' :
                                isSelected ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 
                                'bg-[#0e1117] border-slate-800 hover:border-slate-600 text-slate-200'}
                            `}
                          >
                            {word.kr.split(',')[0]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-4">
                      {shuffledEn.map(word => {
                        const isMatched = matchedIds.has(word.id);
                        const isSelected = selectedEnId === word.id;
                        const isError = errorIds.has(word.id);
                        return (
                          <button
                            key={`en-${word.id}`}
                            disabled={isMatched}
                            onClick={() => handleMatchClick(word.id, 'en')}
                            className={`p-5 rounded-2xl border-2 transition-all duration-300 font-bold text-sm md:text-base h-20 flex items-center justify-center text-center
                              ${isMatched ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500/50' : 
                                isError ? 'bg-rose-500/20 border-rose-500 animate-[shake_0.4s_ease-in-out]' :
                                isSelected ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 
                                'bg-[#0e1117] border-slate-800 hover:border-slate-600 text-slate-200'}
                            `}
                          >
                            {word.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {matchedIds.size === matchPool.length && matchPool.length > 0 && (
                    <div className="mt-12 animate-in zoom-in duration-300 flex flex-col items-center">
                      <p className="text-emerald-400 font-black text-2xl mb-6">ALL PAIRS MATCHED!</p>
                      <button 
                        onClick={generateMatchPool}
                        className="bg-indigo-600 px-8 py-3 rounded-2xl text-white font-bold hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
                      >
                        Next Round
                      </button>
                    </div>
                  )}
                </div>
              ) : !state.currentWord ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center z-10">
                  <p className="text-3xl font-bold text-slate-500 mb-8 max-w-md">{state.message || (words.length === 0 ? '단어 목록이 비어있습니다. 단어를 추가해주세요!' : '학습 완료!')}</p>
                  {words.length > 0 && (
                    <button 
                      onClick={() => { setExcludeMastered(false); setState(initialQuizState); getNextWord(); }}
                      className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-full font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                    >
                      Restart Session
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="w-full flex justify-between items-center mb-8 z-10">
                    <div className="flex items-center gap-3">
                      {state.isSpeaking && (
                        <div className="flex items-center gap-2 text-indigo-400 animate-pulse bg-indigo-500/5 px-3 py-1.5 rounded-full border border-indigo-500/20">
                          <div className="flex gap-1">
                            <div className="w-1 h-3 bg-indigo-500 animate-[bounce_1s_infinite_0.1s]"></div>
                            <div className="w-1 h-4 bg-indigo-500 animate-[bounce_1s_infinite_0.2s]"></div>
                            <div className="w-1 h-3 bg-indigo-500 animate-[bounce_1s_infinite_0.3s]"></div>
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-[0.1em]">Speaking</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 bg-[#080a0f] px-3 py-1.5 rounded-full border border-slate-800">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mastered</span>
                      <button onClick={() => toggleMastered(state.currentWord!.id)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${state.currentWord.isMastered ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-[#11141b] border border-slate-700'}`}>
                        <svg className={`w-4 h-4 ${state.currentWord.isMastered ? 'text-white' : 'text-slate-800'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center w-full text-center space-y-12 z-10">
                    <div className="space-y-6 w-full">
                      <div className="bg-[#1a1c24] p-6 md:p-10 rounded-3xl border border-slate-800/50 max-w-2xl mx-auto shadow-inner">
                        <h2 className={`font-bold text-slate-100 transition-all leading-relaxed ${quizMode === QuizMode.EXAMPLE_GAP ? 'text-xl md:text-3xl font-medium italic text-slate-400' : 'text-4xl md:text-6xl tracking-tight'}`}>
                          {getQuestionText()}
                        </h2>
                      </div>
                      {state.showHint && quizMode === QuizMode.EXAMPLE_GAP && (
                        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 animate-in fade-in slide-in-from-top-4 duration-300 max-w-2xl mx-auto">
                           <p className="text-indigo-400 font-bold text-lg md:text-xl">{state.currentWord.exampleKr}</p>
                        </div>
                      )}
                    </div>

                    <div className="w-full max-w-lg mx-auto space-y-8">
                      <div className="relative group">
                        <input
                          ref={inputRef}
                          type="text"
                          value={state.userInput}
                          onChange={(e) => setState(prev => ({ ...prev, userInput: e.target.value }))}
                          disabled={state.isSubmitted}
                          placeholder="Type your answer..."
                          className={`w-full text-center py-5 px-6 md:py-6 md:px-8 text-2xl md:text-3xl font-bold bg-[#080a0f] border-b-2 outline-none transition-all rounded-2xl ${state.isSubmitted ? state.isCorrect ? 'border-emerald-500 text-emerald-400' : 'border-rose-500 text-rose-400' : 'border-slate-800 focus:border-purple-500 focus:shadow-[0_10px_30px_rgba(168,85,247,0.15)]'}`}
                          autoFocus
                        />
                      </div>
                      {state.isSubmitted && (
                        <div className="flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200">
                          <div className={`px-8 py-3 md:px-10 md:py-4 rounded-3xl font-black text-lg md:text-xl shadow-2xl tracking-tight transition-all scale-105 ${state.isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                            {state.isCorrect ? 'PERFECT!' : `CORRECT: ${quizMode === QuizMode.EN_TO_KR ? state.currentWord.kr : state.currentWord.en}`}
                          </div>
                          <div className="flex gap-4">
                            <button onClick={handleRetry} className="bg-[#1a1c24] px-5 py-2.5 md:px-6 md:py-3 rounded-2xl border border-slate-800 text-slate-400 hover:text-slate-200 transition-all font-bold flex items-center gap-3 active:scale-95 text-sm">
                              <kbd className="px-2 py-1 bg-slate-800 rounded-md text-[9px] border border-slate-700">BS</kbd> Retry
                            </button>
                            <button onClick={handleNext} className="bg-indigo-600 px-6 py-2.5 md:px-8 md:py-3 rounded-2xl text-white hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all font-bold flex items-center gap-3 active:scale-95 text-sm">
                              <kbd className="px-2 py-1 bg-indigo-500 rounded-md text-[9px] border border-indigo-400">Enter</kbd> Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[#11141b] rounded-[2rem] shadow-2xl border border-slate-800/50 overflow-hidden">
            <div className="p-8 border-b border-slate-800/50 flex flex-wrap gap-4 justify-between items-center bg-[#161a24]">
              <div className="flex flex-col">
                <h2 className="text-2xl font-black text-slate-200 uppercase tracking-tighter">Word Studio</h2>
                <span className="text-xs text-slate-500 font-bold">{words.length} Vocabulary Units</span>
              </div>
              <div className="flex gap-3">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                  IMPORT CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#0e1117] text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    <th className="px-8 py-5">State</th>
                    <th className="px-8 py-5 text-slate-200">Term</th>
                    <th className="px-8 py-5">Interpretation</th>
                    <th className="px-8 py-5 text-center">Accuracy</th>
                    <th className="px-8 py-5 text-center">Action</th>
                    <th className="px-8 py-5 text-right">Raw Stats</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {words.map((word) => {
                    const accuracy = calculateAccuracy(word);
                    return (
                      <tr key={word.id} className="hover:bg-slate-800/20 transition-colors group">
                        <td className="px-8 py-5">
                          <button onClick={() => toggleMastered(word.id)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${word.isMastered ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-[#080a0f] border border-slate-800'}`}>
                            <svg className={`w-4 h-4 ${word.isMastered ? 'text-white' : 'text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                          </button>
                        </td>
                        <td className="px-8 py-5 font-black text-lg text-slate-100 group-hover:text-purple-400 transition-colors">{word.en}</td>
                        <td className="px-8 py-5 text-slate-400 font-medium truncate max-w-xs">{word.kr}</td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col items-center gap-2">
                            <span className={`text-xs font-black tracking-tighter ${accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{accuracy}%</span>
                            <div className="w-20 bg-[#080a0f] h-1.5 rounded-full overflow-hidden border border-slate-800">
                              <div className={`h-full transition-all duration-1000 ${accuracy >= 80 ? 'bg-emerald-500' : accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${accuracy}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <button 
                            onClick={() => startFromWord(word)}
                            className="p-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition-all border border-indigo-500/20"
                            title="Start quiz from here"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                          </button>
                        </td>
                        <td className="px-8 py-5 text-right font-mono text-[10px] text-slate-600">
                          <span className="text-emerald-500">+{word.correctCount}</span> / <span className="text-rose-500">-{word.incorrectCount}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {words.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center text-slate-500 font-bold italic">No words found. Please import a CSV file.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Words Total', val: words.length, color: 'text-slate-100' },
            { label: 'Mastered', val: words.filter(w => w.isMastered).length, color: 'text-emerald-400' },
            { label: 'Learning', val: words.filter(w => !w.isMastered).length, color: 'text-purple-400' },
            { label: 'Avg Accuracy', val: `${words.length === 0 ? 0 : Math.round((words.reduce((acc, w) => acc + calculateAccuracy(w), 0) / words.length))}%`, color: 'text-indigo-400' }
          ].map((stat, i) => (
            <div key={i} className="bg-[#11141b] p-6 rounded-3xl border border-slate-800 flex flex-col items-center text-center shadow-lg group hover:border-slate-700 transition-all">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{stat.label}</div>
              <div className={`text-3xl font-black ${stat.color} group-hover:scale-110 transition-transform`}>{stat.val}</div>
            </div>
          ))}
        </div>

        <footer className="mt-16 text-center space-y-4">
          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              <kbd className="bg-[#11141b] px-2 py-1 rounded-md border border-slate-800 text-slate-300">Enter</kbd> Submit / Next
            </div>
            {quizMode === QuizMode.EXAMPLE_GAP && (
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                <kbd className="bg-[#11141b] px-2 py-1 rounded-md border border-slate-800 text-slate-300">Ctrl</kbd> Hint
              </div>
            )}
          </div>
          <p className="text-slate-700 text-[9px] uppercase tracking-[0.4em] font-black">AI Vocab Training Interface v2.5</p>
        </footer>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
};

export default App;
