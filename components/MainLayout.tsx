
import React, { useState, useEffect } from 'react';
import { getSystemVoices } from '../services/geminiService';
import { useWordData } from '../hooks/useWordData';
import { useQuiz } from '../hooks/useQuiz';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// Components
import Header from './Header';
import QuizView from './QuizView';
import ListView from './ListView';
import StatsSection from './StatsSection';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'quiz' | 'list'>('quiz');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('voca_native_voice') || '');
  
  const wordData = useWordData();
  const quiz = useQuiz(wordData.words, wordData.setWords, selectedVoice);

  // Keyboard Shortcuts - Now decoupled from Auth
  useKeyboardShortcuts(activeTab, quiz);

  useEffect(() => {
    const loadVoices = () => {
      const voices = getSystemVoices();
      setAvailableVoices(voices);
      if (!selectedVoice && voices.length > 0) {
        const preferred = voices.find(v => v.lang.includes('en-US')) || voices[0];
        setSelectedVoice(preferred.name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [selectedVoice]);

  useEffect(() => {
    if (selectedVoice) localStorage.setItem('voca_native_voice', selectedVoice);
  }, [selectedVoice]);

  const startFromWord = (word: any) => {
    quiz.setState((p:any) => ({ ...quiz.initialQuizState, currentWord: word }));
    setActiveTab('quiz');
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100 flex flex-col items-center py-10 px-4">
      <div className="max-w-4xl w-full">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        {activeTab === 'quiz' ? (
          <QuizView 
            quiz={quiz} 
            voices={availableVoices} 
            selectedVoice={selectedVoice} 
            setSelectedVoice={setSelectedVoice}
            wordsCount={wordData.words.length}
          />
        ) : (
          <ListView wordData={wordData} onStartQuiz={startFromWord} />
        )}
        <StatsSection words={wordData.words} />
        <footer className="mt-16 text-center">
          <p className="text-slate-700 text-[9px] uppercase tracking-[0.4em] font-black italic">
            AI Vocab Training Interface v7.0 - Standalone Core
          </p>
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;
