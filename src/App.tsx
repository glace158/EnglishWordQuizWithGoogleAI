/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, BookOpen, Languages } from 'lucide-react';

import { WordItem, QuizMode, OrderMode, TrainingStats, WordList } from './types';
import { DEFAULT_WORDS } from './data/defaultWords';
import { getEnglishVoices } from './utils/tts';
import { WordStudio } from './components/WordStudio';
import { StatsCards } from './components/StatsCards';
import { TriviaShowdown } from './components/TriviaShowdown';
import { EnglishPractice } from './components/EnglishPractice';

// Local storage key constants
const STORAGE_WORDS_KEY = 'vocamaster_words_deck_v6';
const STORAGE_LISTS_KEY = 'vocamaster_word_lists_v1';
const STORAGE_ACTIVE_LIST_ID_KEY = 'vocamaster_active_list_id_v1';

export default function App() {
  // Load or initialize Word Lists
  const [lists, setLists] = useState<WordList[]>(() => {
    if (typeof window !== 'undefined') {
      const storedMetadata = localStorage.getItem('vocamaster_word_lists_metadata_v2');
      if (storedMetadata) {
        try {
          const parsedMeta = JSON.parse(storedMetadata);
          if (Array.isArray(parsedMeta) && parsedMeta.length > 0) {
            const loadedLists: WordList[] = parsedMeta.map((meta: { id: string; name: string }) => {
              const storedWords = localStorage.getItem(`vocamaster_word_list_words_v2_${meta.id}`);
              let listWords: WordItem[] = [];
              if (storedWords) {
                try {
                  listWords = JSON.parse(storedWords);
                } catch (e) {
                  console.error(`Failed to parse words for list ${meta.id}`, e);
                }
              }
              return {
                id: meta.id,
                name: meta.name,
                words: listWords
              };
            });
            return loadedLists;
          }
        } catch (e) {
          console.error('Failed to parse stored metadata', e);
        }
      }
      
      // Migration: Try migrating from older unified vocamaster_word_lists_v1
      const storedLists = localStorage.getItem(STORAGE_LISTS_KEY);
      if (storedLists) {
        try {
          const parsed = JSON.parse(storedLists);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Save to new separate schema
            const meta = parsed.map(l => ({ id: l.id, name: l.name }));
            localStorage.setItem('vocamaster_word_lists_metadata_v2', JSON.stringify(meta));
            parsed.forEach(l => {
              localStorage.setItem(`vocamaster_word_list_words_v2_${l.id}`, JSON.stringify(l.words));
            });
            return parsed;
          }
        } catch (e) {
          console.error('Failed to parse old stored lists', e);
        }
      }
    }
    
    // Fallback: migrate from single deck or use defaults
    let initialWords = DEFAULT_WORDS;
    if (typeof window !== 'undefined') {
      const storedWords = localStorage.getItem(STORAGE_WORDS_KEY);
      if (storedWords) {
        try {
          initialWords = JSON.parse(storedWords);
        } catch (e) {}
      }
    }

    const defaultList: WordList = {
      id: 'default-list-id',
      name: '기본 단어장',
      words: initialWords
    };

    const secondList: WordList = {
      id: 'second-list-id',
      name: '추가 단어장',
      words: [
        {
          id: 'sample-list2-1',
          word: 'challenge',
          meaning: '도전; 이의를 제기하다',
          sentence: 'Don’t run away from a challenge.',
          sentence_translation: '도전에서 도망치지 마세요.',
          attempts: 0,
          correctCount: 0,
          mastered: false,
        },
        {
          id: 'sample-list2-2',
          word: 'triumph',
          meaning: '승리, 큰 업적',
          sentence: 'The championship was a great triumph.',
          sentence_translation: '그 챔피언십은 위대한 승리였습니다.',
          attempts: 0,
          correctCount: 0,
          mastered: false,
        }
      ]
    };

    const initial = [defaultList, secondList];
    if (typeof window !== 'undefined') {
      const meta = initial.map(l => ({ id: l.id, name: l.name }));
      localStorage.setItem('vocamaster_word_lists_metadata_v2', JSON.stringify(meta));
      initial.forEach(l => {
        localStorage.setItem(`vocamaster_word_list_words_v2_${l.id}`, JSON.stringify(l.words));
      });
    }
    return initial;
  });

  const [activeListId, setActiveListId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const storedActiveId = localStorage.getItem(STORAGE_ACTIVE_LIST_ID_KEY);
      if (storedActiveId && storedActiveId !== 'undefined') {
        return storedActiveId;
      }
    }
    return 'default-list-id';
  });

  // Vocabulary Deck State (sync with active list)
  const [words, setWords] = useState<WordItem[]>(() => {
    const activeList = lists.find(l => l.id === activeListId) || lists[0];
    return activeList ? activeList.words : DEFAULT_WORDS;
  });

  // Save changes to LocalStorage and sync active list
  const handleWordsChange = (newWords: WordItem[]) => {
    setWords(newWords);
    
    // Save current active list's words separately
    localStorage.setItem(`vocamaster_word_list_words_v2_${activeListId}`, JSON.stringify(newWords));

    const updatedLists = lists.map(list => {
      if (list.id === activeListId) {
        return { ...list, words: newWords };
      }
      return list;
    });
    setLists(updatedLists);
    
    const meta = updatedLists.map(l => ({ id: l.id, name: l.name }));
    localStorage.setItem('vocamaster_word_lists_metadata_v2', JSON.stringify(meta));
  };

  const handleActiveListIdChange = (id: string) => {
    setActiveListId(id);
    localStorage.setItem(STORAGE_ACTIVE_LIST_ID_KEY, id);
    const targetList = lists.find(l => l.id === id);
    if (targetList) {
      setWords(targetList.words);
    }
  };

  const handleListsChange = (newLists: WordList[]) => {
    setLists(newLists);
    
    // Save metadata
    const meta = newLists.map(l => ({ id: l.id, name: l.name }));
    localStorage.setItem('vocamaster_word_lists_metadata_v2', JSON.stringify(meta));
    
    // Save words for all lists individually under separate keys
    newLists.forEach(l => {
      localStorage.setItem(`vocamaster_word_list_words_v2_${l.id}`, JSON.stringify(l.words));
    });
    
    // Ensure activeListId still exists
    let newActiveId = activeListId;
    if (!newLists.some(l => l.id === activeListId)) {
      newActiveId = newLists[0]?.id || '';
      setActiveListId(newActiveId);
      localStorage.setItem(STORAGE_ACTIVE_LIST_ID_KEY, newActiveId);
    }

    const activeList = newLists.find(l => l.id === newActiveId);
    if (activeList) {
      setWords(activeList.words);
    }
  };

  // Weak word threshold state
  const [weakThreshold, setWeakThreshold] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vocamaster_weak_threshold_v1');
      if (stored) return Number(stored);
    }
    return 80;
  });

  const handleWeakThresholdChange = (val: number) => {
    setWeakThreshold(val);
    localStorage.setItem('vocamaster_weak_threshold_v1', String(val));
  };

  // Main navigation view-mode switcher
  const [viewMode, setViewMode] = useState<'TRIVIA' | 'STUDIO' | 'PRACTICE'>('TRIVIA');

  // Prevent practicing or viewing 'ai-english-practice-list' outside EnglishPractice mode
  useEffect(() => {
    if ((viewMode === 'TRIVIA' || viewMode === 'STUDIO') && activeListId === 'ai-english-practice-list') {
      const normalList = lists.find(l => l.id !== 'ai-english-practice-list');
      if (normalList) {
        handleActiveListIdChange(normalList.id);
      }
    }
  }, [viewMode, activeListId, lists]);

  // Start learning from specific word state
  const [startWordId, setStartWordId] = useState<string | null>(null);

  const handleStartQuiz = (wordId: string) => {
    setStartWordId(wordId);
    setViewMode('TRIVIA');
  };

  // Interactive Quiz Modes
  const [quizMode, setQuizMode] = useState<QuizMode>('KR_EN');
  
  // Quiz preferences
  const [orderMode, setOrderMode] = useState<OrderMode>('ORDERED');
  const [skipMastered, setSkipMastered] = useState<boolean>(false);
  const [voiceName, setVoiceName] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load browser voice list dynamically
  const initializeSpeechVoices = () => {
    const voices = getEnglishVoices();
    setAvailableVoices(voices);
    if (voices.length > 0 && !voiceName) {
      // Pick a standard Google or Natural male/female voice if available, otherwise fallback
      const preferred = voices.find(v => v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('mark')) || voices[0];
      setVoiceName(preferred.name);
    }
  };

  useEffect(() => {
    initializeSpeechVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = initializeSpeechVoices;
    }
  }, []);

  // Compute live global statistical numbers safely
  const aggregatedStats = useMemo<TrainingStats>(() => {
    const totalCount = words.length;
    const masteredCount = words.filter(w => w.mastered).length;
    const learningCount = totalCount - masteredCount;
    
    let sumAttempts = 0;
    let sumCorrect = 0;
    words.forEach(w => {
      sumAttempts += w.attempts || 0;
      sumCorrect += w.correctCount || 0;
    });

    const accuracyRate = sumAttempts > 0 ? Math.round((sumCorrect / sumAttempts) * 100) : 0;

    return {
      wordsTotal: totalCount,
      mastered: masteredCount,
      learning: learningCount,
      avgAccuracy: accuracyRate
    };
  }, [words]);

  return (
    <div className="min-h-screen flex flex-col bg-[#070913] text-zinc-100 selection:bg-purple-600/30 selection:text-purple-300 relative">
      
      {/* Radiant atmosphere background spots */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-indigo-900/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[450px] h-[450px] bg-fuchsia-950/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[350px] h-[350px] bg-violet-950/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Main Container */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 md:py-12 flex flex-col justify-between relative z-10">
        
        {/* App Title & Premium Subtitle */}
        <header className="mb-6 flex flex-col items-center">
          <h1 
            className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 tracking-tight text-center" 
            style={{ textShadow: '0 0 40px rgba(168,85,247,0.12)' }}
            id="heading-logo"
          >
            VocaMaster AI
          </h1>
          <p className="text-zinc-500 italic text-xs md:text-sm font-medium tracking-wide mt-1 text-center font-sans">
            High-Fidelity Learning Interface
          </p>

          {/* Section Navigation Toggles */}
          <div className="flex bg-[#0E101D] border border-zinc-900 p-1.5 rounded-2xl w-fit mx-auto mt-6 shadow-inner" id="view-mode-tabs">
            <button 
              onClick={() => setViewMode('TRIVIA')}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                viewMode === 'TRIVIA' 
                  ? 'bg-gradient-to-r from-[#3B2FF2] to-[#5a4ffa] text-white shadow-[0_0_20px_rgba(59,47,242,0.35)]' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
              }`}
              id="tab-trivia"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              Trivia Showdown
            </button>
            <button 
              onClick={() => setViewMode('STUDIO')}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                viewMode === 'STUDIO' 
                  ? 'bg-gradient-to-r from-[#3B2FF2] to-[#5a4ffa] text-white shadow-[0_0_20px_rgba(59,47,242,0.35)]' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
              }`}
              id="tab-studio"
            >
              <BookOpen className="w-4 h-4 text-pink-400" />
              Word Studio
            </button>
            <button 
              onClick={() => setViewMode('PRACTICE')}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                viewMode === 'PRACTICE' 
                  ? 'bg-gradient-to-r from-[#3B2FF2] to-[#5a4ffa] text-white shadow-[0_0_20px_rgba(59,47,242,0.35)]' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
              }`}
              id="tab-practice"
            >
              <Languages className="w-4 h-4 text-emerald-400" />
              영어 연습
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 flex flex-col justify-center my-4">
          {viewMode === 'TRIVIA' ? (
            <TriviaShowdown
              words={words}
              onWordsChange={handleWordsChange}
              quizMode={quizMode}
              setQuizMode={setQuizMode}
              orderMode={orderMode}
              setOrderMode={setOrderMode}
              skipMastered={skipMastered}
              setSkipMastered={setSkipMastered}
              voiceName={voiceName}
              setVoiceName={setVoiceName}
              availableVoices={availableVoices}
              setViewMode={setViewMode}
              startWordId={startWordId}
              setStartWordId={setStartWordId}
              weakThreshold={weakThreshold}
              onWeakThresholdChange={handleWeakThresholdChange}
            />
          ) : viewMode === 'STUDIO' ? (
            /* Managed Word Studio interface */
            <WordStudio 
              words={words} 
              onWordsChange={handleWordsChange} 
              voiceName={voiceName}
              onStartQuiz={handleStartQuiz}
              weakThreshold={weakThreshold}
              onWeakThresholdChange={handleWeakThresholdChange}
              lists={lists}
              onListsChange={handleListsChange}
              activeListId={activeListId}
              onActiveListIdChange={handleActiveListIdChange}
            />
          ) : (
            <EnglishPractice
              words={words}
              onWordsChange={handleWordsChange}
              lists={lists}
              activeListId={activeListId}
              onListsChange={handleListsChange}
            />
          )}
        </main>

        {/* Global Statistics Bento Panel */}
        <footer className="mt-8 pt-6 border-t border-zinc-900/60 space-y-6">
          <StatsCards stats={aggregatedStats} />

          <p className="text-center text-[10px] font-mono tracking-widest text-zinc-600">
            AI VOCAB TRAINING INTERFACE V6.0 - MODULAR ARCHITECTURE
          </p>
        </footer>

      </div>
    </div>
  );
}
