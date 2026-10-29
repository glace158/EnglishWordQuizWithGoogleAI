import React from 'react';
import { 
  Volume2, 
  Check, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';
import { WordItem, QuizMode, OrderMode } from '../types';
import { useQuizTrainer } from '../hooks/useQuizTrainer';

interface TriviaShowdownProps {
  words: WordItem[];
  onWordsChange: (newWords: WordItem[]) => void;
  quizMode: QuizMode;
  setQuizMode: (mode: QuizMode) => void;
  orderMode: OrderMode;
  setOrderMode: (mode: OrderMode) => void;
  skipMastered: boolean;
  setSkipMastered: (skip: boolean) => void;
  voiceName: string;
  setVoiceName: (name: string) => void;
  availableVoices: SpeechSynthesisVoice[];
  setViewMode: (mode: 'TRIVIA' | 'STUDIO') => void;
  startWordId?: string | null;
  setStartWordId?: (id: string | null) => void;
  weakThreshold?: number;
  onWeakThresholdChange?: (val: number) => void;
}

export function TriviaShowdown({
  words,
  onWordsChange,
  quizMode,
  setQuizMode,
  orderMode,
  setOrderMode,
  skipMastered,
  setSkipMastered,
  voiceName,
  setVoiceName,
  availableVoices,
  setViewMode,
  startWordId,
  setStartWordId,
  weakThreshold = 80,
  onWeakThresholdChange
}: TriviaShowdownProps) {
  
  const {
    activeQueue,
    queueIndex,
    setQueueIndex,
    inputValue,
    setInputValue,
    evaluationState,
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
  } = useQuizTrainer({
    words,
    onWordsChange,
    quizMode,
    orderMode,
    skipMastered,
    voiceName,
    isActive: true,
    startWordId,
    setStartWordId,
    weakThreshold
  });

  return (
    <div className="space-y-6" id="trivia-view-container">
      
      {/* Horizontal Chips: Game categories bar mirroring image layout */}
      <div className="overflow-x-auto pb-2 scrollbar-none flex gap-2 w-full justify-center" id="chips-categories-row">
        <div className="flex gap-2 p-1 bg-[#090A11]/60 border border-zinc-900/80 rounded-2xl">
          {/* Mode 1: Korean To English */}
          <button
            onClick={() => { setQuizMode('KR_EN'); }}
            className={`px-5 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all cursor-pointer flex items-center gap-1.5 border ${
              quizMode === 'KR_EN'
                ? 'bg-[#15122b] text-purple-300 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)] font-extrabold'
                : 'text-zinc-500 hover:text-zinc-300 bg-transparent border-transparent'
            }`}
          >
            KR➔EN
          </button>

          {/* Mode 2: English To Korean */}
          <button
            onClick={() => { setQuizMode('EN_KR'); }}
            className={`px-5 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all cursor-pointer flex items-center gap-1.5 border ${
              quizMode === 'EN_KR'
                ? 'bg-[#15122b] text-purple-300 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)] font-extrabold'
                : 'text-zinc-500 hover:text-zinc-300 bg-transparent border-transparent'
            }`}
          >
            EN➔KR
          </button>

          {/* Mode 3: Sentence blank */}
          <button
            onClick={() => { setQuizMode('SENT_BLANK'); }}
            className={`px-5 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all cursor-pointer flex items-center gap-1.5 border ${
              quizMode === 'SENT_BLANK'
                ? 'bg-[#15122b] text-purple-300 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)] font-extrabold'
                : 'text-zinc-500 hover:text-zinc-300 bg-transparent border-transparent'
            }`}
            title="영어 예문 속의 단어 빈칸 맞추기"
          >
            SENT
          </button>

          {/* Mode 4: Audio hearing test */}
          <button
            onClick={() => { setQuizMode('HEAR'); }}
            className={`px-5 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all cursor-pointer flex items-center gap-1.5 border ${
              quizMode === 'HEAR'
                ? 'bg-[#15122b] text-purple-300 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)] font-extrabold'
                : 'text-zinc-500 hover:text-zinc-300 bg-transparent border-transparent'
            }`}
            title="듣고 영단어 스펠링 쓰기"
          >
            HEAR
          </button>
        </div>
      </div>

      {/* Preferences Strip (Ordered/Weighted, Voice, Skip mastered) */}
      <div 
        className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center justify-between p-4 bg-[#0B0D16]/80 border border-zinc-900 rounded-2xl"
        id="controls-ribbon"
      >
        {/* 1. Play sequence selector */}
        <div className="flex flex-col gap-2 items-center md:items-start justify-center md:justify-start">
          <div className="flex gap-1.5 items-center justify-center md:justify-start">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mr-1">SEQ:</span>
            <div className="flex bg-[#111320] border border-zinc-850 p-1 rounded-xl">
              <button
                onClick={() => setOrderMode('ORDERED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  orderMode === 'ORDERED' 
                    ? 'bg-[#3b2ff2] text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Ordered
              </button>
              <button
                onClick={() => setOrderMode('WEIGHTED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  orderMode === 'WEIGHTED' 
                    ? 'bg-[#3b2ff2] text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="틀린 횟수가 높은 순서로 우선 배치"
              >
                Weighted
              </button>
              <button
                onClick={() => setOrderMode('SHUFFLED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  orderMode === 'SHUFFLED' 
                    ? 'bg-[#3b2ff2] text-white text-semibold' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Shuffled
              </button>
              <button
                onClick={() => setOrderMode('WEAK_ONLY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  orderMode === 'WEAK_ONLY' 
                    ? 'bg-[#3b2ff2] text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="자주 틀리는 단어 집중 학습"
              >
                Weak
              </button>
            </div>
          </div>
          {onWeakThresholdChange && (
            <div className="flex items-center gap-2 px-1 text-xs" title="취약 단어 분류 기준 (정답률 이하)">
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider">WEAK:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={weakThreshold}
                onChange={(e) => onWeakThresholdChange(Number(e.target.value))}
                className="w-20 sm:w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                id="select-weak-threshold-trivia"
              />
              <span className="text-amber-300 font-bold font-mono text-[11px]">≤ {weakThreshold}%</span>
            </div>
          )}
        </div>

        {/* 2. Web speech Voice Selection */}
        <div className="flex items-center justify-center gap-1.5 w-full">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">VOICE:</span>
          <select
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            className="bg-[#111320] text-xs py-2 px-3 border border-zinc-850 rounded-xl text-zinc-300 focus:outline-none focus:ring-1 focus:ring-purple-600 max-w-[190px] md:max-w-xs truncate cursor-pointer"
          >
            {availableVoices.length === 0 ? (
              <option value="">Browser default English</option>
            ) : (
              availableVoices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name.replace('Microsoft', 'MS').split('(')[0]}
                </option>
              ))
            )}
          </select>
        </div>

        {/* 3. Skip mastered */}
        <div className="flex justify-center md:justify-end items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipMastered}
              onChange={(e) => setSkipMastered(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-800 text-purple-600 accent-purple-650 focus:ring-opacity-40"
            />
            <span>SKIP MASTERED</span>
          </label>
          <span className="text-zinc-600 text-xs px-2 border-l border-zinc-800">
            QUOTA <strong className="text-purple-400 font-mono">{activeQueue.length} Left</strong>
          </span>
        </div>
      </div>

      {/* Main Quiz Training Plate Card (Tethered to active item) */}
      {activeQueue.length === 0 ? (
        <div className="bg-[#10121C] border border-zinc-850 rounded-3xl p-12 shadow-2xl text-center max-w-3xl mx-auto space-y-6 flex flex-col items-center">
          <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800 text-purple-400">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-extrabold text-zinc-100">학습할 단어가 없습니다!</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              {skipMastered 
                ? '마스터하지 않은 단어 개수가 현재 0개입니다. "SKIP MASTERED" 옵션을 끄거나 Word Studio에서 새로운 단어를 등록하세요!' 
                : '등록된 영어 단어가 비어 있습니다. 아래 기본 단어를 가동하거나 CSV 단어장을 업로드하세요.'}
            </p>
          </div>
          <div className="flex gap-3">
            {skipMastered && (
              <button
                onClick={() => setSkipMastered(false)}
                className="px-5 py-2.5 bg-[#3B2FF2] hover:bg-[#3225df] font-bold text-xs text-white rounded-xl shadow-lg transition-all"
              >
                Skip Mastered 해제
              </button>
            )}
            <button
              onClick={() => setViewMode('STUDIO')}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:brightness-110 font-bold text-xs text-white rounded-xl shadow-lg transition-all"
            >
              Word Studio 오픈하기
            </button>
          </div>
        </div>
      ) : !currentWord ? (
        <div className="bg-[#10121C] border border-zinc-850 rounded-3xl p-12 text-center max-w-3xl mx-auto space-y-4">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-zinc-200">인덱스 범위를 초과했습니다</h3>
          <button
            onClick={() => setQueueIndex(0)}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl"
          >
            처음부터 다시 학습
          </button>
        </div>
      ) : (
        <div className="bg-[#10121D] border border-zinc-850 rounded-3xl p-6 md:p-8 shadow-2xl relative max-w-3xl mx-auto" id="stage-card">
          
          {/* Card head: error rate & Mastered indicator */}
          <div className="flex items-center justify-between pb-6 border-b border-zinc-900/60" id="card-top-decor">
            <div className="text-left font-mono">
              <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase block">ERROR RATE</span>
              <span className="text-sm font-extrabold text-[#A855F7] mt-0.5 block">{currentWordErrorRate}%</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Interactive clue tool */}
              {quizMode !== 'EN_KR' && (
                <button
                  onClick={() => setHintLettersRevealed(prev => Math.min(prev + 1, currentWord.word.length))}
                  className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-400 hover:text-zinc-200 bg-[#161824] hover:bg-zinc-850 border border-zinc-850 rounded-lg transition-colors cursor-pointer"
                >
                  Clue: {getSpellingClue()}
                </button>
              )}

              {/* Bookmark/Mastered Checkbox Toggler */}
              <button
                onClick={handleToggleCurrentMastered}
                className={`p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-center cursor-pointer ${
                  currentWord.mastered
                    ? 'bg-green-950/40 border-green-500/40 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.15)] font-extrabold'
                    : 'bg-[#151724] border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                }`}
                title="이 단어를 배움 마스터로 지정 (단축키: Alt+M)"
                id="master-check-btn"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Core stage prompt: English or korean display */}
          <div className="py-8 md:py-12 flex flex-col items-center justify-center space-y-4" id="target-phrase-screen">
            {/* Switch target content display based on selected mode */}
            {quizMode === 'KR_EN' && (
              <div className="space-y-2 text-center w-full">
                <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">KOREAN MEANING</span>
                <h2 className="text-3xl md:text-5xl font-extrabold text-zinc-100 tracking-wide font-sans leading-tight">
                  {currentWord.meaning}
                </h2>
              </div>
            )}

            {quizMode === 'EN_KR' && (
              <div className="flex flex-col items-center gap-3 text-center w-full">
                <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">ENGLISH WORD</span>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <h2 className="text-3xl md:text-5xl font-extrabold text-zinc-100 tracking-wide font-mono">
                    {currentWord.word}
                  </h2>
                  <button
                    onClick={playCurrentTts}
                    className="p-3 bg-[#1A1C2E] hover:bg-[#252844] text-purple-400 hover:text-purple-300 rounded-full border border-purple-500/20 active:scale-95 shadow-[0_0_12px_rgba(124,58,237,0.1)] transition-all cursor-pointer"
                    title="발음 듣기 (단축키: Alt+S)"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {quizMode === 'SENT_BLANK' && (
              <div className="w-full space-y-4 text-center">
                <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase block">FILL IN THE BLANK</span>
                
                <div className="p-6 bg-black/45 rounded-2xl border border-zinc-900/60 max-w-2xl mx-auto shadow-inner text-left">
                  <p className="text-lg md:text-xl text-zinc-200 leading-relaxed font-sans font-medium">
                    {getMaskedSentence(currentWord.sentence, currentWord.word)}
                  </p>
                </div>
              </div>
            )}

            {quizMode === 'HEAR' && (
              <div className="flex flex-col items-center gap-4 py-4 text-center w-full">
                <span className="text-[10px] font-bold text-[#D946EF] tracking-widest uppercase">AUDIO LISTENING SPELL</span>
                
                <button
                  onClick={playCurrentTts}
                  className="px-6 py-4 bg-gradient-to-r from-purple-950 to-indigo-950 hover:from-purple-900 hover:to-indigo-900 border border-purple-500/30 text-purple-300 rounded-2xl flex items-center gap-3 font-semibold group active:scale-95 shadow-lg transition-all cursor-pointer"
                  title="발음 재생 (단축키: Alt+S)"
                >
                  <Volume2 className="w-6 h-6 animate-bounce" />
                  발음 재생하기 [Alt+S]
                </button>
              </div>
            )}
          </div>

          {/* Active Text Input with glowing outline system */}
          <div className="max-w-xl mx-auto space-y-4" id="input-container-box">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                readOnly={evaluationState === 'CORRECT'}
                placeholder={getPlaceholderText()}
                className={`w-full bg-[#090A11] p-4 pr-14 rounded-2xl font-medium text-sm md:text-base border transition-all duration-300 focus:outline-none focus:ring-0 ${
                  evaluationState === 'CORRECT'
                    ? 'border-green-500 text-green-300 shadow-[0_0_20px_rgba(34,197,94,0.25)] bg-green-950/10'
                    : evaluationState === 'INCORRECT'
                    ? 'border-red-500 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.25)] bg-red-950/10'
                    : 'border-zinc-800 hover:border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:shadow-[0_0_20px_rgba(168,85,247,0.15)] bg-[#090A11]/90'
                }`}
                id="user-translation-input"
              />

              {/* Microphone icon layout element (doubles as a play sound shortcut) */}
              <button
                type="button"
                onClick={playCurrentTts}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
                title="정확한 발음 가이드 스피치 (단축키: Alt+S)"
                id="mic-play-btn"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* Result notifications under spelling fields */}
            {evaluationState === 'CORRECT' && (
              <div className="flex items-center gap-2 p-3 bg-green-950/20 text-green-400 rounded-xl text-xs border border-green-900/40 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4" />
                <div>
                  <strong>정답입니다!</strong>
                  {currentWord.sentence && (
                    <p className="mt-1 text-[11px] text-zinc-400 leading-snug">
                      예시: <em>"{currentWord.sentence}"</em>
                    </p>
                  )}
                  {quizMode === 'SENT_BLANK' && currentWord.sentence_translation && (
                    <p className="mt-1 text-[11px] text-zinc-300 font-medium border-t border-green-950/40 pt-1 mt-1">
                      해석: {currentWord.sentence_translation}
                    </p>
                  )}
                  {quizMode === 'HEAR' && currentWord.meaning && (
                    <p className="mt-1 text-[11px] text-purple-300 font-medium border-t border-green-950/40 pt-1 mt-1">
                      뜻: {currentWord.meaning}
                    </p>
                  )}
                </div>
              </div>
            )}

            {evaluationState === 'INCORRECT' && (
              <div className="p-4 bg-red-950/20 text-red-400 rounded-xl text-xs border border-red-900/40 animate-in fade-in duration-200 space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  <span><strong>틀렸습니다!</strong> 다시 시도하시겠습니까, 아니면 다음 단어로 건너뛰시겠습니까?</span>
                </div>
                
                {/* Choice options for retry or skip on mistake as requested by the user */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRetryCurrentWord}
                    className="px-3.5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold rounded-lg text-[11px] font-sans tracking-wide transition-colors"
                    id="mistake-retry-btn"
                  >
                    Retry (다시 가전)
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipToNext}
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-[11px] font-sans tracking-wide transition-colors"
                    id="mistake-skip-btn"
                  >
                    Skip (건너뛰기)
                  </button>
                </div>
              </div>
            )}

            {/* Footer Card Controls (Enter button or multi-state choice) */}
            <div className="pt-2 flex justify-center">
              {evaluationState === 'IDLE' ? (
                <button
                  onClick={checkAnswerCore}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#201D5B] to-[#3B2FF2] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-950/20 hover:shadow-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                  id="submit-answer-btn"
                >
                  Submit Answer (Enter)
                </button>
              ) : evaluationState === 'CORRECT' ? (
                <div className="w-full flex gap-3 text-xs">
                  <button
                    onClick={handleRetryCurrentWord}
                    className="flex-1 py-3.5 rounded-2xl bg-[#1A1230] hover:bg-[#20153D] border border-purple-500/25 text-[#D946EF] font-bold text-center uppercase tracking-wide transition-all cursor-pointer"
                    id="bottom-action-retry-correct"
                  >
                    Retry Item (Backspace)
                  </button>
                  <button
                    onClick={handleSkipToNext}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-green-750 to-green-600 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider border border-green-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    id="correct-advance-btn"
                  >
                    Next Word (Enter)
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-full flex gap-3 text-xs">
                  <button
                    onClick={handleRetryCurrentWord}
                    className="flex-1 py-3.5 rounded-2xl bg-[#1A1230] hover:bg-[#20153D] border border-purple-500/25 text-[#D946EF] font-bold text-center uppercase tracking-wide transition-all cursor-pointer"
                    id="bottom-action-retry"
                  >
                    Retry Item (Backspace)
                  </button>
                  <button
                    onClick={handleSkipToNext}
                    className="flex-1 py-3.5 rounded-2xl bg-[#0F101A] hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-center uppercase tracking-wide transition-all cursor-pointer"
                    id="bottom-action-skip"
                  >
                    Skip Word (Enter)
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
