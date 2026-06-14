
import React, { useRef, useEffect, useMemo } from 'react';
import { QuizMode, SelectionMode } from '../types';
import { speakText } from '../services/geminiService';

interface Props {
  quiz: any;
  voices: SpeechSynthesisVoice[];
  selectedVoice: string;
  setSelectedVoice: (v: string) => void;
  wordsCount: number;
}

const QuizView: React.FC<Props> = ({ quiz, voices, selectedVoice, setSelectedVoice, wordsCount }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quiz.state.currentWord && !quiz.state.isSubmitted && ![QuizMode.WORD_MATCH, QuizMode.DET_SPEAKING, QuizMode.DET_WRITING].includes(quiz.quizMode)) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [quiz.state.currentWord, quiz.state.isSubmitted, quiz.quizMode]);

  const getQuestionText = () => {
    const { currentWord, aiContextSentence } = quiz.state;
    if (!currentWord) return '';
    if (quiz.quizMode === QuizMode.AI_DICTATION) return '';
    if (quiz.quizMode === QuizMode.AI_SENTENCE_GEN) return aiContextSentence || "AI 생성 중...";
    if (quiz.quizMode === QuizMode.KR_TO_EN) return currentWord.kr;
    if (quiz.quizMode === QuizMode.EN_TO_KR) return currentWord.en;
    if (quiz.quizMode === QuizMode.EXAMPLE_GAP) {
      const word = currentWord.en;
      const displayHint = word[0] + (word.length > 1 ? ' ' + '_ '.repeat(word.length - 1).trim() : '');
      return currentWord.example.replace(new RegExp(`\\b${word}\\b`, 'gi'), displayHint);
    }
    return '';
  };

  const handleRetry = () => {
    quiz.setState((prev: any) => ({ ...prev, userInput: '', isSubmitted: false, isCorrect: false, aiFeedback: '', detFeedback: undefined, showHint: false, showModelAnswer: false }));
  };

  const toggleHint = () => {
    quiz.setState((prev: any) => ({ ...prev, showHint: !prev.showHint }));
  };

  const toggleModelAnswer = () => {
    quiz.setState((prev: any) => ({ ...prev, showModelAnswer: !prev.showModelAnswer }));
  };

  const playDictation = () => {
    if (quiz.state.aiDictationSentence) {
      speakText(quiz.state.aiDictationSentence, selectedVoice);
    }
  };

  const playWord = () => {
    if (quiz.state.currentWord) {
      speakText(quiz.state.currentWord.en, selectedVoice);
    }
  };

  const shuffledKr = useMemo(() => [...quiz.matchPool].sort(() => Math.random() - 0.5), [quiz.matchPool]);
  const shuffledEn = useMemo(() => [...quiz.matchPool].sort(() => Math.random() - 0.5), [quiz.matchPool]);

  const currentErrorRate = useMemo(() => {
    const w = quiz.state.currentWord;
    if (!w) return 0;
    const total = w.correctCount + w.incorrectCount;
    return total === 0 ? 0 : Math.round((w.incorrectCount / total) * 100);
  }, [quiz.state.currentWord]);

  const isDetMode = quiz.quizMode === QuizMode.DET_SPEAKING || quiz.quizMode === QuizMode.DET_WRITING;

  const cleanDetText = (text: string | undefined) => {
    if (!text) return '';
    // Remove labels and markdown
    return text
      .replace(/Question:/gi, '')
      .replace(/Prep time:\s*\d+\s*seconds/gi, '')
      .replace(/Response time:\s*[\d\s\w]+/gi, '')
      .replace(/\*\*/g, '')
      .replace(/^[\*\-•]\s+/gm, '• ')
      .replace(/\n\s*---\s*\n/g, '\n')
      .replace(/---/g, '')
      .trim();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Quiz Mode Selector */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {[ 
          { mode: QuizMode.KR_TO_EN, title: 'KR➔EN' }, 
          { mode: QuizMode.EN_TO_KR, title: 'EN➔KR' }, 
          { mode: QuizMode.EXAMPLE_GAP, title: 'SENT' }, 
          { mode: QuizMode.WORD_MATCH, title: 'MATCH' },
          { mode: QuizMode.AI_SENTENCE_GEN, title: 'DRAFT' },
          { mode: QuizMode.AI_DICTATION, title: 'HEAR' },
          { mode: QuizMode.DET_SPEAKING, title: 'DET SPK' },
          { mode: QuizMode.DET_WRITING, title: 'DET WRT' }
        ].map(item => (
          <button 
            key={item.mode} 
            onClick={() => { 
              quiz.setQuizMode(item.mode); 
              quiz.getNextWord(item.mode); 
            }} 
            className={`group relative p-2 md:p-3 rounded-xl border transition-all duration-300 ${quiz.quizMode === item.mode ? 'bg-[#1a1c24] border-purple-500/50 shadow-lg' : 'bg-[#0e1117] border-slate-800 hover:border-slate-700'}`}
          >
            <div className={`font-black text-[9px] md:text-xs ${quiz.quizMode === item.mode ? 'text-purple-400' : 'text-slate-400'}`}>{item.title}</div>
            {quiz.quizMode === item.mode && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
            )}
          </button>
        ))}
      </div>

      {/* Settings Panel */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-[#0e1117] p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex bg-[#080a0f] p-1 rounded-lg">
          <button onClick={() => quiz.setSelectionMode(SelectionMode.ORDERED)} className={`px-3 py-1.5 text-xs font-bold rounded-md ${quiz.selectionMode === SelectionMode.ORDERED ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Ordered</button>
          <button onClick={() => quiz.setSelectionMode(SelectionMode.RANDOM)} className={`px-3 py-1.5 text-xs font-bold rounded-md ${quiz.selectionMode === SelectionMode.RANDOM ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.5)]' : 'text-slate-500'}`}>Weighted</button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end leading-none border-r border-slate-800 pr-4">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Quota</span>
            <span className={`text-xs font-bold ${quiz.remainingQuota < 100 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>{quiz.remainingQuota} Left</span>
          </div>
          <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="bg-[#080a0f] border border-slate-800 text-xs rounded-xl p-2 text-slate-300 outline-none max-w-[120px] md:max-w-[150px]">
            {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={quiz.excludeMastered} onChange={(e) => quiz.setExcludeMastered(e.target.checked)} className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-indigo-600" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Skip Mastered</span>
        </label>
      </div>

      {/* Main Quiz Area */}
      <div className="bg-[#11141b] pt-20 pb-8 px-6 md:p-12 rounded-[2.5rem] shadow-2xl border border-slate-800/50 min-h-[520px] flex flex-col relative overflow-hidden">
        {wordsCount === 0 && !isDetMode ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-3xl font-bold text-slate-500 mb-8 uppercase tracking-widest">Database Empty</p>
          </div>
        ) : quiz.quizMode === QuizMode.WORD_MATCH ? (
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <h3 className="text-xl font-bold mb-8 text-slate-400 uppercase tracking-widest">Matching Session</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 w-full max-w-2xl">
              <div className="flex flex-col gap-4">{shuffledKr.map((w: any) => (
                <button key={`kr-${w.id}`} disabled={quiz.matchedIds.has(w.id)} onClick={() => quiz.handleMatchClick(w.id, 'kr')} className={`p-5 rounded-2xl border-2 transition-all h-20 font-bold ${quiz.matchedIds.has(w.id) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500/50' : quiz.errorIds.has(w.id) ? 'bg-rose-500/20 border-rose-500 animate-[shake_0.4s]' : quiz.selectedKrId === w.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' : 'bg-[#0e1117] border-slate-800 text-slate-200 hover:border-slate-600'}`}>{w.kr.split(',')[0]}</button>
              ))}</div>
              <div className="flex flex-col gap-4">{shuffledEn.map((w: any) => (
                <button key={`en-${w.id}`} disabled={quiz.matchedIds.has(w.id)} onClick={() => quiz.handleMatchClick(w.id, 'en')} className={`p-5 rounded-2xl border-2 transition-all h-20 font-bold ${quiz.matchedIds.has(w.id) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500/50' : quiz.errorIds.has(w.id) ? 'bg-rose-500/20 border-rose-500 animate-[shake_0.4s]' : quiz.selectedEnId === w.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' : 'bg-[#0e1117] border-slate-800 text-slate-200 hover:border-slate-600'}`}>{w.en}</button>
              ))}</div>
            </div>
            {quiz.matchedIds.size === quiz.matchPool.length && quiz.matchPool.length > 0 && <button onClick={quiz.generateMatchPool} className="mt-8 bg-indigo-600 px-8 py-3 rounded-2xl text-white font-bold hover:bg-indigo-500 transition-all active:scale-95 shadow-xl shadow-indigo-500/30">Next Set ➔</button>}
          </div>
        ) : isDetMode ? (
          /* DET MODE UI */
          <div className="flex-1 flex flex-col w-full space-y-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-xl font-black text-indigo-400 uppercase tracking-widest">DET Practice Mode</h3>
              {quiz.state.isTimerActive && (
                <div className="bg-rose-600/10 px-4 py-1 rounded-full border border-rose-500/30 animate-pulse">
                  <span className="text-sm font-black text-rose-400 font-mono">{formatTime(quiz.state.timerSeconds || 0)}</span>
                </div>
              )}
            </div>

            {quiz.state.isAiLoading && !quiz.state.isSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                 <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                 <p className="text-sm font-black text-slate-400 uppercase animate-pulse">AI Processing...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Section 1: Test Task */}
                <div className="bg-[#1a1c24] p-8 rounded-3xl border border-slate-800 shadow-xl">
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    Test Task
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-slate-100 leading-relaxed whitespace-pre-wrap">
                    {cleanDetText(quiz.state.detTask?.task)}
                  </div>
                </div>

                {/* Section 2: Key Structure Toggle */}
                <div className="bg-[#0e1117] rounded-2xl border border-slate-800 overflow-hidden">
                  <button onClick={toggleHint} className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-800/20 transition-all">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Section 2: Key Structure</span>
                    <svg className={`w-4 h-4 text-slate-500 transition-transform ${quiz.state.showHint ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  {quiz.state.showHint && (
                    <div className="px-6 pb-6 pt-2 text-sm text-slate-400 font-medium leading-relaxed italic whitespace-pre-wrap border-t border-slate-800/50">
                      {cleanDetText(quiz.state.detTask?.structure)}
                    </div>
                  )}
                </div>

                {/* Section 5: USER ACTION REQUIRED */}
                <div className="bg-indigo-600/5 p-4 rounded-2xl border border-indigo-500/20 flex items-center gap-4">
                  <div className="bg-indigo-600 p-2 rounded-lg text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">User Action Required</span>
                    <p className="text-xs text-slate-300 font-bold">{quiz.state.detTask?.userAction}</p>
                  </div>
                </div>

                {/* User Input Area */}
                <div className="space-y-4">
                  <textarea 
                    value={quiz.state.userInput}
                    onChange={(e) => quiz.setState((p:any)=>({...p, userInput: e.target.value}))}
                    placeholder={quiz.quizMode === QuizMode.DET_SPEAKING ? "Dictate your answer or type it here..." : "Type your essay here..."}
                    className="w-full h-44 bg-[#080a0f] border-2 border-slate-800 p-8 rounded-[2rem] text-slate-100 outline-none focus:border-indigo-500/50 transition-all resize-none font-medium text-lg"
                    disabled={quiz.state.isSubmitted}
                  />
                  <div className="flex gap-4">
                    {quiz.quizMode === QuizMode.DET_SPEAKING && !quiz.state.isSubmitted && (
                      <button 
                        onClick={quiz.state.isListening ? quiz.stopListening : quiz.startListening} 
                        className={`p-5 rounded-2xl flex items-center gap-3 transition-all ${quiz.state.isListening ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 005.93 6.93V17H7a1 1 0 100 2h6a1 1 0 100-2h-1.93v-2.07z"></path></svg>
                        <span className="font-black text-xs uppercase">{quiz.state.isListening ? 'Stop Recording' : 'Start Recording'}</span>
                      </button>
                    )}
                    {!quiz.state.isSubmitted && (
                      <button 
                        onClick={quiz.handleSubmit}
                        disabled={!quiz.state.userInput.trim() || quiz.state.isAiLoading}
                        className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        SUBMIT ANSWER
                      </button>
                    )}
                  </div>
                </div>

                {/* Section 6: SELF-CHECK (Checklist) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {quiz.state.detTask?.selfCheck.map((item: string, idx: number) => (
                    <div key={idx} className="bg-[#161a24] p-4 rounded-2xl border border-slate-800 flex items-start gap-3">
                      <div className="w-5 h-5 rounded-md border border-slate-700 flex items-center justify-center text-indigo-500 mt-0.5">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-600 uppercase mb-1">Check {idx + 1}</span>
                        <span className="text-xs text-slate-300 font-medium leading-tight">{item}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Section 3: Detailed Feedback & Model Answer */}
                {quiz.state.isSubmitted && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* ANALYSIS RESULTS HEADING */}
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-2 border-l-2 border-indigo-500">Analysis Results</div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
                      {/* Left: Score Estimate and Overall Feedback */}
                      <div className="flex flex-col gap-6">
                        <div className="bg-[#161a24] p-8 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col gap-6">
                          <div className="flex items-center gap-4">
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Score Estimate</span>
                            <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-sm border border-emerald-500/30">
                              {quiz.state.detFeedback?.scoreEstimate}
                            </span>
                          </div>
                          <div className="text-slate-300 font-medium leading-relaxed text-base">
                            {quiz.state.detFeedback?.overallFeedback}
                          </div>
                        </div>

                        {/* AI Corrected Answer Box */}
                        <div className="bg-[#1a1c24] p-8 rounded-[2rem] border border-indigo-500/20 shadow-xl flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Suggested Improvement</span>
                            <button onClick={() => speakText(quiz.state.detFeedback?.correctedAnswer, selectedVoice)} className="text-indigo-400 hover:text-white transition-colors">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 011 1v12a1 1 0 01-1.707.707L4.586 12H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707A1 1 0 0111 3z" /></svg>
                            </button>
                          </div>
                          <div className="text-slate-200 italic leading-relaxed text-lg border-l-4 border-indigo-500/30 pl-6">
                            {quiz.state.detFeedback?.correctedAnswer}
                          </div>
                        </div>
                      </div>

                      {/* Right: Detailed Self-Check */}
                      <div className="bg-[#161a24] p-8 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col gap-6 h-fit">
                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest">6. Self-Check</div>
                        <div className="space-y-6">
                          {quiz.state.detFeedback?.selfCheckResults.map((item: any, idx: number) => (
                            <div key={idx} className="flex gap-4 items-start group">
                              <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${item.status ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                {item.status ? (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-black text-slate-200">{item.title}</span>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Model Answer */}
                    <div className="bg-[#1a1c24] p-10 rounded-[2.5rem] border-2 border-indigo-500/30 shadow-[0_20px_50px_rgba(79,70,229,0.15)]">
                      <button onClick={toggleModelAnswer} className="w-full text-left">
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                          <span>Section 3: Model Answer</span>
                          <span className="bg-indigo-500 text-white px-2 py-0.5 rounded text-[8px]">{quiz.state.showModelAnswer ? 'HIDE' : 'SHOW'}</span>
                        </div>
                        {quiz.state.showModelAnswer && (
                          <div className="text-slate-100 font-medium leading-relaxed whitespace-pre-wrap text-lg md:text-xl border-t border-slate-800 pt-8">
                            {cleanDetText(quiz.state.detTask?.modelAnswer)}
                          </div>
                        )}
                      </button>
                      <div className="mt-10 flex gap-4">
                        <button onClick={handleRetry} className="flex-1 py-5 bg-slate-800/50 text-slate-400 rounded-2xl font-black text-sm uppercase hover:bg-slate-700 transition-all">Retry</button>
                        <button onClick={quiz.getNextWord} className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all">Next DET Challenge ➔</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : quiz.state.currentWord ? (
          <div className="flex-1 flex flex-col items-center justify-center w-full text-center space-y-8">
            {/* Error Rate Indicator (Left Side) */}
            <div className="absolute top-6 left-6 md:top-8 md:left-8 flex flex-col items-start leading-none opacity-80">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Error Rate</span>
              <span className={`text-sm font-black ${currentErrorRate > 50 ? 'text-rose-500' : currentErrorRate > 20 ? 'text-amber-500' : 'text-indigo-400'}`}>
                {currentErrorRate}%
              </span>
            </div>

            {/* Mastery Toggle (Right Side) */}
            <button 
              onClick={quiz.toggleCurrentMastery}
              className={`absolute top-6 right-6 md:top-8 md:right-8 w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all z-20 ${quiz.state.currentWord?.isMastered ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20 text-white' : 'bg-slate-900/50 border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'}`}
              title="Mark as Mastered"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
            </button>

            <div className="bg-[#1a1c24] p-6 md:p-10 rounded-3xl border border-slate-800 w-full max-w-2xl shadow-inner relative flex flex-col items-center justify-center min-h-[160px]">
              {quiz.state.isAiLoading && !quiz.state.isSubmitted ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-xs font-black text-indigo-400 uppercase tracking-widest animate-pulse">AI Generating Content...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  {quiz.quizMode === QuizMode.AI_DICTATION && (
                    <button 
                      onClick={playDictation}
                      className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-500/40 hover:bg-indigo-500 transition-all active:scale-90 border-4 border-white/10"
                    >
                      <svg className="w-10 h-10 md:w-12 md:h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.414 0A5.982 5.982 0 0115 10a5.982 5.982 0 01-1.414 4.243 1 1 0 01-1.414-1.414A3.982 3.982 0 0013 10a3.982 3.982 0 00-1.414-2.828a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                  )}
                  <h2 className={`font-bold text-slate-100 flex items-center justify-center gap-4 ${
                    quiz.quizMode === QuizMode.EXAMPLE_GAP || quiz.quizMode === QuizMode.AI_SENTENCE_GEN || quiz.quizMode === QuizMode.AI_DICTATION
                      ? 'text-xl md:text-2xl italic text-slate-300 leading-relaxed px-4' 
                      : (quiz.quizMode === QuizMode.KR_TO_EN ? 'text-3xl md:text-5xl tracking-tight' : 'text-4xl md:text-7xl tracking-tighter')
                  }`}>
                    {getQuestionText()}
                    {quiz.quizMode === QuizMode.KR_TO_EN && !quiz.state.isSubmitted && (
                      <button onClick={playWord} className="p-2 md:p-3 bg-slate-800 rounded-2xl text-slate-400 hover:text-indigo-400 transition-all hover:bg-slate-700 active:scale-90 shadow-lg" title="Pronounce">
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16.02C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z" /></svg>
                      </button>
                    )}
                  </h2>
                </div>
              )}
              {(quiz.quizMode === QuizMode.AI_SENTENCE_GEN || quiz.quizMode === QuizMode.AI_DICTATION) && !quiz.state.isAiLoading && (
                <button 
                  onClick={toggleHint}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg hover:bg-indigo-500 transition-colors"
                >
                  {quiz.state.showHint ? `Target Word: ${quiz.state.currentWord.en}` : 'Show Hint'}
                </button>
              )}
            </div>
            
            {(quiz.state.showHint || quiz.state.isSubmitted) && quiz.quizMode === QuizMode.EXAMPLE_GAP && (
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 animate-in fade-in slide-in-from-top-4 duration-300 max-w-2xl mx-auto">
                <p className="text-indigo-400 font-bold text-lg">{quiz.state.currentWord.exampleKr}</p>
              </div>
            )}

            <div className="w-full max-w-xl space-y-6">
              <div className="flex items-center gap-2 md:gap-4 w-full justify-center">
                {!quiz.state.isSubmitted && !quiz.state.isAiLoading && (
                  <div className="w-12 md:w-16 pointer-events-none opacity-0 shrink-0"></div>
                )}
                <input 
                  ref={inputRef}
                  type="text" 
                  value={quiz.state.userInput} 
                  onChange={(e) => quiz.setState((p:any)=>({...p, userInput: e.target.value}))} 
                  disabled={quiz.state.isSubmitted || quiz.state.isAiLoading} 
                  placeholder={quiz.state.isListening ? "Listening..." : "Type translation..."} 
                  className={`flex-1 min-w-0 text-center py-4 px-4 md:py-6 md:px-6 text-xl md:text-4xl font-bold bg-[#080a0f] border-b-4 outline-none rounded-2xl transition-all duration-300 ${
                    quiz.state.isSubmitted 
                      ? quiz.state.isCorrect ? 'border-emerald-500 text-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.1)]' : 'border-rose-500 text-rose-400 shadow-[0_10px_30_rgba(244,63,94,0.1)]' 
                      : 'border-slate-800 focus:border-indigo-500 text-slate-100 shadow-xl'
                  }`}
                />
                {!quiz.state.isSubmitted && !quiz.state.isAiLoading && (
                  <button 
                    onClick={quiz.startListening}
                    className={`shrink-0 w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-2xl transition-all shadow-lg ${quiz.state.isListening ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30' : 'bg-[#0e1117] border-2 border-slate-800 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-slate-800'}`}
                    title="Speak"
                  >
                    <svg className="w-6 h-6 md:w-8 md:h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 005.93 6.93V17H7a1 1 0 100 2h6a1 1 0 100-2h-1.93v-2.07z" clipRule="evenodd"></path>
                    </svg>
                  </button>
                )}
              </div>
              
              {quiz.state.isSubmitted ? (
                <div className="flex flex-col gap-4 animate-in zoom-in-95 duration-300">
                  <div className="px-8 py-6 rounded-[2.5rem] font-black shadow-2xl border-2 border-white/10 flex flex-col gap-3" style={{ backgroundColor: quiz.state.isCorrect ? '#10b981' : '#f43f5e' }}>
                    <div className="text-white text-xl md:text-2xl flex items-center justify-center gap-2 text-center">
                      {quiz.state.isCorrect 
                        ? '✨ PERFECT! ✨' 
                        : (quiz.quizMode === QuizMode.AI_SENTENCE_GEN) 
                          ? 'NEEDS REVIEW' 
                          : (quiz.quizMode === QuizMode.AI_DICTATION)
                            ? 'TRY AGAIN'
                            : `CORRECT: ${quiz.quizMode === QuizMode.EN_TO_KR ? quiz.state.currentWord.kr : quiz.state.currentWord.en}`
                      }
                    </div>
                    {quiz.quizMode === QuizMode.AI_DICTATION && (
                       <div className="text-white/80 text-sm italic bg-black/10 p-3 rounded-xl">
                         Original: {quiz.state.aiDictationSentence}
                       </div>
                    )}
                    {quiz.state.aiFeedback && (
                      <div className="text-white/95 text-xs md:text-sm font-bold bg-black/20 p-5 rounded-2xl whitespace-pre-wrap text-left leading-relaxed">
                        {quiz.state.aiFeedback}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleRetry} className="w-full sm:flex-1 py-5 bg-slate-800/60 text-slate-400 hover:text-slate-100 rounded-2xl font-black hover:bg-slate-700 transition-all flex items-center justify-center gap-3 border border-slate-700/50 group active:scale-95">
                       <svg className="w-6 h-6 group-hover:rotate-[-45deg] transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                       <div className="flex flex-col items-start leading-[1.1]">
                         <span className="text-lg uppercase tracking-tight">Retry</span>
                         <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Backspace</span>
                       </div>
                    </button>
                    <button onClick={quiz.getNextWord} className="w-full sm:flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black text-2xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-4 shadow-xl shadow-indigo-500/30 active:scale-95 border-b-4 border-indigo-800">
                       <div className="flex flex-col items-end leading-none">
                         <span className="text-xl">Next Challenge</span>
                         <span className="text-[10px] opacity-60 uppercase font-black">Enter</span>
                       </div>
                       <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                   {(quiz.quizMode === QuizMode.EXAMPLE_GAP || quiz.quizMode === QuizMode.AI_SENTENCE_GEN || quiz.quizMode === QuizMode.AI_DICTATION) && (
                     <button onClick={toggleHint} className={`w-full sm:w-auto px-8 py-5 rounded-2xl font-bold border-2 transition-all flex items-center justify-center gap-3 ${quiz.state.showHint ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400 shadow-inner' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.674a1 1 0 00.922-.606l.39-.9a.999.999 0 00-.922-1.399h-4.994a.999.999 0 00-.922 1.399l.39.9a1 1 0 00.922.606zM15 7a3 3 0 11-6 0 3 3 0 016 0zm-3 4v3"></path></svg>
                        <div className="flex flex-col items-start leading-none">
                          <span className="text-base">Hint</span>
                          <span className="text-[9px] uppercase opacity-40">Ctrl</span>
                        </div>
                     </button>
                   )}
                   <button 
                      onClick={quiz.handleSubmit} 
                      disabled={!quiz.state.userInput.trim() || quiz.state.isAiLoading} 
                      className="w-full sm:flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-4 border-b-4 border-indigo-800"
                   >
                      {quiz.state.isAiLoading ? (
                        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                      ) : 'Submit (Enter)'}
                   </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizView;
