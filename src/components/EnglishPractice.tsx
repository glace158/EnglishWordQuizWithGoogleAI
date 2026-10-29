/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Languages, Loader2, Check, RotateCcw, ArrowRight, Sparkles, 
  Play, BookOpen, AlertCircle, Info, HelpCircle, FileText, CheckCircle2, PenTool,
  Volume2, Trash2, Download, Upload, Copy
} from 'lucide-react';
import { WordItem, WordList } from '../types';

interface EnglishPracticeProps {
  words: WordItem[];
  onWordsChange: (newWords: WordItem[]) => void;
  lists: WordList[];
  activeListId: string;
  onListsChange: (newLists: WordList[]) => void;
}

interface SentencePair {
  korean: string;
  english: string;
  explanation?: string;
}

export function EnglishPractice({ words, onWordsChange, lists, activeListId, onListsChange }: EnglishPracticeProps) {
  const [paragraphInput, setParagraphInput] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDbBackingUp, setIsDbBackingUp] = useState(false);
  const [isDbImporting, setIsDbImporting] = useState(false);
  const [sentencePairs, setSentencePairs] = useState<SentencePair[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  // Saved practice sentences selection state
  const [selectedSavedIndices, setSelectedSavedIndices] = useState<number[]>([]);

  const practiceList = lists.find(l => l.id === 'ai-english-practice-list');
  const savedSentences = practiceList ? practiceList.words : [];

  useEffect(() => {
    if (savedSentences.length > 0) {
      setSelectedSavedIndices(savedSentences.map((_, i) => i));
    } else {
      setSelectedSavedIndices([]);
    }
  }, [savedSentences.length]);

  const toggleSelectSavedIndex = (index: number) => {
    if (selectedSavedIndices.includes(index)) {
      setSelectedSavedIndices(selectedSavedIndices.filter(i => i !== index));
    } else {
      setSelectedSavedIndices([...selectedSavedIndices, index]);
    }
  };

  const toggleSelectAllSaved = () => {
    if (selectedSavedIndices.length === savedSentences.length) {
      setSelectedSavedIndices([]);
    } else {
      setSelectedSavedIndices(savedSentences.map((_, i) => i));
    }
  };

  const handleStartSavedPractice = () => {
    if (selectedSavedIndices.length === 0) {
      showNotification('error', '학습할 저장된 문장을 하나 이상 선택해 주세요.');
      return;
    }

    const selectedPairs: SentencePair[] = selectedSavedIndices.map(index => {
      const word = savedSentences[index];
      return {
        english: word.word,
        korean: word.meaning,
        explanation: (word.sentence_translation && word.sentence_translation !== word.meaning) ? word.sentence_translation : ''
      };
    });

    setParagraphInput(''); // Clear input text to avoid confusion
    setSentencePairs(selectedPairs);
    setCurrentSentenceIndex(0);
    initializeBlockGame(selectedPairs[0]);
    setGameState('block-game');
    showNotification('success', `성공: 내가 저장한 문장 중 ${selectedPairs.length}개를 불러와 영어 학습을 시작합니다!`);
  };

  const saveAndSyncSentences = async (updatedWords: WordItem[], actionMessageSuccess: string, actionMessageFail: string) => {
    const practiceListId = 'ai-english-practice-list';
    const practiceListName = 'AI 영어 연습 문장';

    const existingList = lists.find(l => l.id === practiceListId);
    let updatedLists: WordList[];
    
    if (existingList) {
      updatedLists = lists.map(l => {
        if (l.id === practiceListId) {
          return { ...l, words: updatedWords };
        }
        return l;
      });
    } else {
      const newPracticeList: WordList = {
        id: practiceListId,
        name: practiceListName,
        words: updatedWords
      };
      updatedLists = [...lists, newPracticeList];
    }

    onListsChange(updatedLists);

    try {
      const res = await fetch('/api/supabase/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: updatedWords,
          listId: practiceListId,
          listName: practiceListName
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', actionMessageSuccess + ' (Supabase 클라우드 동기화 완료)');
      } else {
        showNotification('success', actionMessageSuccess + ' (로컬 저장소 반영 완료)');
      }
    } catch (err) {
      console.error('Error syncing:', err);
      showNotification('success', actionMessageSuccess + ' (로컬 저장소 반영 완료)');
    }
  };

  const handleDeleteSavedSentence = (index: number) => {
    const updatedWords = savedSentences.filter((_, i) => i !== index);
    setSelectedSavedIndices([]);
    saveAndSyncSentences(
      updatedWords,
      '선택한 문장이 성공적으로 삭제되었습니다.',
      '문장 삭제 중 오류가 발생했습니다.'
    );
  };

  const handleDeleteSelectedSentences = () => {
    if (selectedSavedIndices.length === 0) {
      showNotification('error', '삭제할 문장을 하나 이상 선택해 주세요.');
      return;
    }
    const updatedWords = savedSentences.filter((_, idx) => !selectedSavedIndices.includes(idx));
    setSelectedSavedIndices([]);
    saveAndSyncSentences(
      updatedWords,
      `${selectedSavedIndices.length}개의 문장이 성공적으로 삭제되었습니다.`,
      '선택 삭제 중 오류가 발생했습니다.'
    );
  };

  const handleBackupToDatabase = async () => {
    if (savedSentences.length === 0) {
      showNotification('error', '백업할 문장이 존재하지 않습니다.');
      return;
    }
    setIsDbBackingUp(true);
    try {
      const practiceListId = 'ai-english-practice-list';
      const practiceListName = 'AI 영어 연습 문장';
      
      const res = await fetch('/api/supabase/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: savedSentences,
          listId: practiceListId,
          listName: practiceListName
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', `성공: 현재 저장된 문장 ${savedSentences.length}개를 데이터베이스(Supabase)에 성공적으로 백업 완료했습니다!`);
      } else {
        if (data.error === 'MISSING_LIST_COLUMNS') {
          showNotification('error', data.message);
        } else {
          showNotification('error', `데이터베이스 백업 실패: ${data.message || '데이터베이스에 연결할 수 없습니다.'}`);
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('error', '데이터베이스 백업 중 오류가 발생했습니다. 네트워크 또는 환경설정을 확인해 주세요.');
    } finally {
      setIsDbBackingUp(false);
    }
  };

  const handleImportFromDatabase = async () => {
    setIsDbImporting(true);
    try {
      const res = await fetch('/api/supabase/load?list_id=ai-english-practice-list');
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        showNotification('error', `가져오기 실패: ${data.message || '데이터베이스에서 데이터를 불러올 수 없습니다.'}`);
        return;
      }
      
      const dbList = data.lists?.find((l: any) => l.id === 'ai-english-practice-list');
      const dbWords = dbList?.words || [];
      
      if (dbWords.length === 0) {
        showNotification('info', '가져올 백업 데이터가 데이터베이스에 존재하지 않습니다.');
        return;
      }
      
      // Merge dbWords into local savedSentences
      const mergedWords = [...savedSentences];
      let importedCount = 0;
      
      dbWords.forEach((word: any) => {
        const exists = mergedWords.some(existing => normalizeText(existing.word) === normalizeText(word.word));
        if (!exists) {
          mergedWords.push({
            id: word.id || `practice-imported-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            word: String(word.word),
            meaning: String(word.meaning),
            sentence: String(word.sentence || word.word),
            sentence_translation: String(word.sentence_translation || word.meaning),
            attempts: Number(word.attempts || 0),
            correctCount: Number(word.correctCount || 0),
            mastered: Boolean(word.mastered ?? true)
          });
          importedCount++;
        }
      });
      
      if (importedCount === 0) {
        showNotification('info', '데이터베이스에서 가져온 문장이 이미 모두 현재 목록에 존재합니다.');
        return;
      }
      
      // Save merged to local and sync
      await saveAndSyncSentences(
        mergedWords,
        `데이터베이스 가져오기 성공: ${importedCount}개의 신규 문장을 성공적으로 불러왔습니다!`,
        '데이터베이스 가져오기 중 동기화 오류가 발생했습니다.'
      );
    } catch (err: any) {
      console.error(err);
      showNotification('error', '데이터베이스 로딩 중 오류가 발생했습니다. 네트워크 또는 환경설정을 확인해 주세요.');
    } finally {
      setIsDbImporting(false);
    }
  };

  const handleCopyToClipboard = () => {
    try {
      if (savedSentences.length === 0) {
        showNotification('error', '복사할 문장이 존재하지 않습니다.');
        return;
      }
      const dataStr = JSON.stringify(savedSentences, null, 2);
      navigator.clipboard.writeText(dataStr);
      showNotification('success', '성공: 문장 데이터가 클립보드에 복사되었습니다! 파일 대신 텍스트로 보관할 수 있습니다.');
    } catch (err) {
      console.error(err);
      showNotification('error', '클립보드 복사 중 오류가 발생했습니다.');
    }
  };
  
  // Game state: 
  // 'input' -> input paragraph
  // 'block-game' -> clicked scrambled words assembly
  // 'typing-game' -> direct text typing test
  // 'summary' -> completed session summary
  const [gameState, setGameState] = useState<'input' | 'block-game' | 'typing-game' | 'summary'>('input');

  // Block Game State
  const [shuffledBlocks, setShuffledBlocks] = useState<{ id: number; text: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [blockGameResult, setBlockGameResult] = useState<'correct' | 'wrong' | 'playing'>('playing');

  // Typing Game State
  const [typingInput, setTypingInput] = useState('');
  const [typingResult, setTypingResult] = useState<'correct' | 'wrong' | 'none'>('none');
  const [showAnswerHint, setShowAnswerHint] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Ref to scroll to top or auto-focus
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef<HTMLInputElement>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const playAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } else {
      showNotification('error', '이 브라우저는 음성 합성(TTS)을 지원하지 않습니다.');
    }
  };

  // Helper to shuffle array (Fisher-Yates)
  const shuffleArray = (array: any[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Utility to normalize strings for comparison
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"’‘“]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // 1. Fetch translation from server
  const handleStartTranslate = async () => {
    if (!paragraphInput.trim()) {
      showNotification('error', '학습할 한국어 또는 영어 문장을 입력해 주세요.');
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: paragraphInput })
      });

      const data = await response.json();
      if (data.success && Array.isArray(data.sentences) && data.sentences.length > 0) {
        setSentencePairs(data.sentences);
        setCurrentSentenceIndex(0);
        initializeBlockGame(data.sentences[0]);
        setGameState('block-game');
        showNotification('success', `AI가 ${data.sentences.length}개의 문장으로 분할 및 번역을 완료했습니다!`);
      } else {
        showNotification('error', data.message || '번역을 가져오지 못했습니다. 다시 한 번 시도해 주세요.');
      }
    } catch (error) {
      console.error('Translation error:', error);
      showNotification('error', '서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Initialize Block Game for a specific sentence pair
  const initializeBlockGame = (pair: SentencePair) => {
    const originalWords = pair.english.split(/\s+/).map(w => w.trim()).filter(Boolean);
    const blocks = originalWords.map((word, index) => ({
      id: index,
      text: word
    }));
    setShuffledBlocks(shuffleArray(blocks));
    setSelectedIds([]);
    setBlockGameResult('playing');
    setShowAnswerHint(false);
  };

  // Initialize Typing Game
  const initializeTypingGame = () => {
    setTypingInput('');
    setTypingResult('none');
    setShowAnswerHint(false);
    setTimeout(() => {
      typingRef.current?.focus();
    }, 100);
  };

  // Block clicking handlers
  const handleBlockClick = (id: number) => {
    if (blockGameResult === 'correct') return;
    if (selectedIds.includes(id)) return;

    const newSelected = [...selectedIds, id];
    setSelectedIds(newSelected);

    // Get active sentence word array
    const currentPair = sentencePairs[currentSentenceIndex];
    const originalWords = currentPair.english.split(/\s+/).map(w => w.trim()).filter(Boolean);

    // Auto check when all blocks are selected
    if (newSelected.length === originalWords.length) {
      const isCorrect = newSelected.every((id, index) => {
        const block = shuffledBlocks.find(b => b.id === id);
        if (!block) return false;
        return normalizeText(block.text) === normalizeText(originalWords[index]);
      });
      if (isCorrect) {
        setBlockGameResult('correct');
        showNotification('success', '참 잘했습니다! 어순을 완벽하게 맞췄습니다.');
      } else {
        setBlockGameResult('wrong');
        showNotification('error', '어순이 올바르지 않습니다. 다시 시도해 보세요.');
      }
    }
  };

  const handleDeselectBlock = (id: number) => {
    if (blockGameResult === 'correct') return;
    const newSelected = selectedIds.filter(val => val !== id);
    setSelectedIds(newSelected);
    setBlockGameResult('playing');
  };

  const handleResetBlockGame = () => {
    setSelectedIds([]);
    setBlockGameResult('playing');
  };

  const handleNextToTypingStage = () => {
    setGameState('typing-game');
    initializeTypingGame();
  };

  // Typing Game checks
  const handleCheckTyping = () => {
    const currentPair = sentencePairs[currentSentenceIndex];
    const userNormalized = normalizeText(typingInput);
    const targetNormalized = normalizeText(currentPair.english);

    if (userNormalized === targetNormalized) {
      setTypingResult('correct');
      showNotification('success', '훌륭합니다! 정확한 문장입니다.');
    } else {
      setTypingResult('wrong');
      showNotification('error', '문장이 일치하지 않습니다. 대소문자와 띄어쓰기, 스펠링을 다시 확인해 보세요.');
    }
  };

  // Proceed to next sentence or complete session
  const handleProceedNext = async () => {
    if (currentSentenceIndex + 1 < sentencePairs.length) {
      const nextIdx = currentSentenceIndex + 1;
      setCurrentSentenceIndex(nextIdx);
      initializeBlockGame(sentencePairs[nextIdx]);
      setGameState('block-game');
    } else {
      // Complete! Save to database
      await handleSaveSession();
      setGameState('summary');
    }
  };

  const handleSaveSession = async () => {
    // Construct new WordItems based on learned sentence pairs
    const newWordItems: WordItem[] = sentencePairs.map((pair, idx) => ({
      id: `practice-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      word: pair.english,
      meaning: pair.korean,
      sentence: pair.english,
      sentence_translation: pair.explanation || pair.korean,
      attempts: 1,
      correctCount: 1,
      mastered: true
    }));

    const practiceListName = 'AI 영어 연습 문장';
    const existingWords = savedSentences;

    // Filter duplicates against existing words in the dedicated practice list
    const uniqueNewItems = newWordItems.filter(item => 
      !existingWords.some(existing => normalizeText(existing.word) === normalizeText(item.word))
    );

    if (uniqueNewItems.length === 0) {
      showNotification('info', `학습한 모든 문장이 이미 '${practiceListName}' 단어장에 존재합니다.`);
      return;
    }

    const updatedPracticeWords = [...existingWords, ...uniqueNewItems];

    await saveAndSyncSentences(
      updatedPracticeWords,
      `${uniqueNewItems.length}개의 문장이 '${practiceListName}' 단어장에 추가되었습니다.`,
      '문장 저장 중 오류가 발생했습니다.'
    );
  };

  const handleRestartPractice = () => {
    setParagraphInput('');
    setSentencePairs([]);
    setGameState('input');
  };

  const activeSentence = sentencePairs[currentSentenceIndex];

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto" id="english-practice-container">
      
      {/* Toast Notification */}
      {notification && (
        <div 
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl transition-all max-w-sm border backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 ${
            notification.type === 'success' ? 'bg-green-950/80 border-green-500/30 text-green-300 shadow-[0_0_20px_rgba(34,197,94,0.15)]' :
            notification.type === 'error' ? 'bg-red-950/80 border-red-500/30 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.15)]' :
            'bg-zinc-900/90 border-zinc-700 text-zinc-300 shadow-[0_0_20px_rgba(255,255,255,0.05)]'
          }`}
          role="alert"
          id="practice-notification"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium text-xs md:text-sm flex-1 leading-relaxed">{notification.message}</p>
        </div>
      )}

      {/* Main Mode Header */}
      <div className="bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-zinc-800/80 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
            <Languages className="w-6 h-6 text-emerald-400" />
            영어 쓰기·말하기 연습 모드
          </h2>
          <p className="text-xs text-zinc-400 max-w-xl">
            한국어 또는 영어 문장을 입력하면 AI가 분석 및 번역을 완료하고, 단어 블록 조립(말하기 어순)과 직접 타이핑(쓰기) 2단계를 통해 완전히 마스터하도록 도와줍니다. 한국어 입력 시에는 DET 120점 수준의 고급 영어가 자동 생성됩니다.
          </p>
        </div>
        {gameState !== 'input' && (
          <button 
            onClick={handleRestartPractice}
            className="px-4 py-2 border border-zinc-800 bg-zinc-950/40 text-xs text-zinc-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 hover:bg-zinc-900/60 font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            처음부터 다시 시작
          </button>
        )}
      </div>

      {/* STAGE 1: INPUT SCREEN */}
      {gameState === 'input' && (
        <div className="bg-[#111322] border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden" id="stage-input-card">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              학습할 한국어 또는 영어 문장 입력
            </label>
            <p className="text-xs text-zinc-500">
              여러 문장으로 구성된 긴 일기, 소설 단락, 영어 기사, 또는 비즈니스 글을 한 번에 입력해도 AI가 문장 단위로 분할하여 개별 학습을 준비해 줍니다.
            </p>
          </div>

          <textarea
            ref={inputRef}
            value={paragraphInput}
            onChange={(e) => setParagraphInput(e.target.value)}
            placeholder="예시 (한국어): 나는 오늘 아침 일찍 일어나 도서관에 갔다. 날씨가 무척 선선해서 걷기에 아주 좋았다.&#10;예시 (영어): I woke up early this morning and went to the library. The weather was so cool that it was perfect for walking."
            className="w-full h-44 px-4 py-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-all leading-relaxed"
          />

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 bg-purple-950/20 border border-purple-900/40 px-3 py-2 rounded-xl text-[11px] text-purple-300 max-w-md">
              <Info className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>완료된 문장들은 저장 시 현재 활성화된 단어장에 자동으로 추가되며 Supabase에 동기화 백업됩니다.</span>
            </div>
            
            <button
              onClick={handleStartTranslate}
              disabled={isTranslating || !paragraphInput.trim()}
              className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs md:text-sm font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(147,51,234,0.15)] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  AI 고급 DET 번역 생성 중...
                </>
              ) : (
                <>
                  <Languages className="w-4 h-4" />
                  AI 분석 및 연습 시작
                </>
              )}
            </button>
          </div>

          {/* 저장된 문장 다시 학습하기 섹션 */}
          <div className="mt-8 border border-zinc-800/60 rounded-2xl p-5 md:p-6 bg-zinc-950/20 space-y-4" id="saved-practice-sentences-module">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-zinc-900 pb-3.5">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  내가 저장한 문장 다시 학습하기
                </h4>
                <p className="text-[11px] text-zinc-400">
                  'AI 영어 연습 문장' 단어장에 저장된 문장들을 관리하고 언제든지 다시 학습할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleImportFromDatabase}
                  disabled={isDbImporting}
                  title="데이터베이스에서 백업 문장 가져오기"
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-[11px] rounded-lg transition-all border border-zinc-850 cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-40"
                >
                  <Upload className={`w-3 h-3 text-emerald-400 ${isDbImporting ? 'animate-spin' : ''}`} />
                  {isDbImporting ? '가져오는 중...' : 'DB 가져오기'}
                </button>
                <button
                  onClick={handleBackupToDatabase}
                  disabled={isDbBackingUp || savedSentences.length === 0}
                  title="데이터베이스에 문장 백업하기"
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-[11px] rounded-lg transition-all border border-zinc-850 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <Download className={`w-3 h-3 text-purple-400 ${isDbBackingUp ? 'animate-pulse' : ''}`} />
                  {isDbBackingUp ? '백업 중...' : 'DB 백업'}
                </button>
                <button
                  onClick={handleCopyToClipboard}
                  disabled={savedSentences.length === 0}
                  title="클립보드로 JSON 텍스트 복사하기"
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-[11px] rounded-lg transition-all border border-zinc-850 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <Copy className="w-3 h-3 text-cyan-400" />
                  클립보드 복사
                </button>
                {savedSentences.length > 0 && (
                  <button
                    onClick={handleDeleteSelectedSentences}
                    disabled={selectedSavedIndices.length === 0}
                    title="선택한 문장 일괄 삭제"
                    className="px-2.5 py-1.5 bg-red-950/25 border border-red-900/40 hover:bg-red-900/20 text-red-400 font-semibold text-[11px] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <Trash2 className="w-3 h-3" />
                    선택 삭제 ({selectedSavedIndices.length}개)
                  </button>
                )}
              </div>
            </div>

            {savedSentences.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAllSaved}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-all font-medium cursor-pointer"
                    >
                      {selectedSavedIndices.length === savedSentences.length ? '전체 선택 해제' : '전체 선택'}
                    </button>
                    <span className="text-[10px] text-zinc-600">|</span>
                    <span className="text-[11px] text-zinc-400 font-medium">
                      총 {savedSentences.length}개 중 {selectedSavedIndices.length}개 선택됨
                    </span>
                  </div>
                  <button
                    onClick={handleStartSavedPractice}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5" />
                    선택한 문장 연습 시작
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
                  {savedSentences.map((sentence, idx) => {
                    const isSelected = selectedSavedIndices.includes(idx);
                    return (
                      <div
                        key={`saved-practice-${idx}`}
                        onClick={() => toggleSelectSavedIndex(idx)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isSelected 
                            ? 'bg-purple-950/15 border-purple-500/35 hover:bg-purple-950/25' 
                            : 'bg-zinc-950/30 border-zinc-900 hover:bg-zinc-900/30 hover:border-zinc-800'
                        }`}
                      >
                        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectSavedIndex(idx)}
                            className="w-4 h-4 rounded border-zinc-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-zinc-900 bg-zinc-900 cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 justify-between">
                            <p className="text-xs font-semibold text-zinc-300 leading-normal">
                              {sentence.meaning}
                            </p>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => playAudio(sentence.word)}
                                title="발음 듣기"
                                className="p-1 hover:bg-zinc-800/80 text-zinc-400 hover:text-white rounded transition-all cursor-pointer flex items-center justify-center shrink-0"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSavedSentence(idx)}
                                title="이 문장 삭제"
                                className="p-1 hover:bg-red-950/40 text-zinc-500 hover:text-red-400 rounded transition-all cursor-pointer flex items-center justify-center shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs font-mono font-bold text-purple-400 leading-normal tracking-wide">
                            {sentence.word}
                          </p>
                          {sentence.sentence_translation && sentence.sentence_translation !== sentence.meaning && (
                            <p className="text-[10px] text-zinc-500 line-clamp-1 hover:line-clamp-none transition-all leading-relaxed pt-1 border-t border-zinc-900/60 mt-1">
                              {sentence.sentence_translation}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center bg-zinc-950/10 rounded-xl border border-dashed border-zinc-900">
                <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400 font-medium">저장된 문장이 아직 없습니다.</p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">
                  직접 문장 연습 후 'AI 영어 연습 문장'에 저장되거나, 이전에 데이터베이스에 백업했던 문장 목록을 가져올 수 있습니다.
                </p>
                <button
                  onClick={handleImportFromDatabase}
                  disabled={isDbImporting}
                  className="mt-3.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-emerald-400 border border-zinc-800 hover:border-zinc-700 text-xs font-bold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
                >
                  <Upload className={`w-3.5 h-3.5 ${isDbImporting ? 'animate-spin' : ''}`} />
                  {isDbImporting ? '데이터베이스 백업 가져오는 중...' : '데이터베이스 백업 가져오기'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GAME PLAY AREA */}
      {(gameState === 'block-game' || gameState === 'typing-game') && activeSentence && (
        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-900 px-5 py-3 rounded-xl text-xs text-zinc-400">
            <span className="font-medium">
              진행 상황: <span className="text-zinc-200 font-bold">{currentSentenceIndex + 1}</span> / {sentencePairs.length} 문장
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${gameState === 'block-game' ? 'bg-purple-500 animate-pulse' : 'bg-zinc-700'}`} />
                1단계: 말하기 어순 조립
              </span>
              <span className="text-zinc-600">•</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${gameState === 'typing-game' ? 'bg-purple-500 animate-pulse' : 'bg-zinc-700'}`} />
                2단계: 쓰기 직접 영작
              </span>
            </div>
          </div>

          {/* Core Game Card */}
          <div className="bg-[#111322] border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-8 shadow-2xl relative">
            
            {/* Display Korean Sentence */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-bold bg-emerald-950/30 px-2.5 py-1 rounded-md border border-emerald-900/30 w-fit block">
                KOREAN SENTENCE
              </span>
              <h3 className="text-lg md:text-xl font-bold text-zinc-100 tracking-tight leading-relaxed">
                {activeSentence.korean}
              </h3>
            </div>

            {/* BLOCK GAME STAGE */}
            {gameState === 'block-game' && (
              <div className="space-y-8" id="block-game-module">
                
                {/* 1. Assembled Word Selection Area */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-bold block">
                      조립 공간 (클릭하면 지워집니다)
                    </span>
                    <button
                      onClick={() => setShowAnswerHint(!showAnswerHint)}
                      className="text-[11px] text-zinc-500 hover:text-purple-400 font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showAnswerHint ? '힌트 숨기기' : '정답 힌트 보기'}
                    </button>
                  </div>

                  {showAnswerHint && (
                    <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1 animate-in slide-in-from-top-2 duration-200">
                      <span className="text-[10px] font-mono text-purple-400 font-bold block uppercase tracking-wider">ANSWER HINT</span>
                      <p className="text-xs text-zinc-400 font-mono tracking-wide">{activeSentence.english}</p>
                    </div>
                  )}

                  <div className="min-h-[70px] p-4 bg-zinc-950/60 border border-zinc-850 rounded-xl flex flex-wrap gap-2 items-center">
                    {selectedIds.length === 0 ? (
                      <span className="text-xs text-zinc-600 italic">아래의 단어 블록을 차례대로 클릭하여 문장을 만드세요.</span>
                    ) : (
                      selectedIds.map(id => {
                        const originalIndex = shuffledBlocks.findIndex(b => b.id === id);
                        const block = shuffledBlocks[originalIndex];
                        return (
                          <button
                            key={`selected-${id}`}
                            onClick={() => handleDeselectBlock(id)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-950 to-indigo-950 border border-purple-800/40 text-xs md:text-sm font-semibold rounded-lg text-purple-300 hover:text-white hover:border-purple-500 hover:bg-purple-900/30 transition-all cursor-pointer shadow-sm animate-in zoom-in-90 duration-150"
                          >
                            {block?.text}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. Shuffled Block Pool */}
                <div className="space-y-3">
                  <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-bold block">
                    단어 블록 풀
                  </span>
                  <div className="flex flex-wrap gap-2.5 p-4 bg-zinc-950/30 rounded-xl border border-zinc-900/40 justify-center">
                    {shuffledBlocks.map(block => {
                      const isSelected = selectedIds.includes(block.id);
                      return (
                        <button
                          key={`pool-${block.id}`}
                          onClick={() => handleBlockClick(block.id)}
                          disabled={isSelected}
                          className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all border duration-200 cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-900/10 border-zinc-900/30 text-zinc-700 opacity-20 cursor-not-allowed select-none'
                              : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300 hover:text-white shadow-[0_2px_5px_rgba(0,0,0,0.1)] active:scale-95'
                          }`}
                        >
                          {block.text}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback Panel */}
                {blockGameResult !== 'playing' && (
                  <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in duration-300 ${
                    blockGameResult === 'correct' 
                      ? 'bg-green-950/40 border-green-900/50 text-green-300' 
                      : 'bg-red-950/40 border-red-900/50 text-red-300'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${blockGameResult === 'correct' ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold">{blockGameResult === 'correct' ? '완벽한 문장입니다!' : '틀린 어순입니다.'}</h4>
                        <p className="text-[11px] opacity-80 mt-0.5">
                          {blockGameResult === 'correct' 
                            ? '다음은 2단계: 키보드로 완벽한 스펠링을 입력하는 "직접 영작 쓰기" 단계입니다.'
                            : '블록을 다시 조합하거나 초기화 버튼을 누르세요.'}
                        </p>
                        {blockGameResult === 'correct' && (
                          <div className="mt-2.5 p-3.5 bg-zinc-950/70 rounded-xl border border-green-500/15 space-y-3 text-left">
                            <div className="flex items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono font-bold text-emerald-500 uppercase tracking-wider block">ENGLISH (영어)</span>
                                <p className="text-xs font-bold text-emerald-400 font-mono tracking-wide">
                                  {activeSentence.english}
                                </p>
                              </div>
                              <button
                                onClick={() => playAudio(activeSentence.english)}
                                title="발음 듣기"
                                className="p-2 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/30 hover:border-purple-500 text-purple-300 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">KOREAN (해석)</span>
                              <p className="text-xs text-zinc-300">
                                {activeSentence.korean}
                              </p>
                            </div>

                            {activeSentence.explanation && (
                              <div className="space-y-1 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-800/50">
                                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider">
                                  <Sparkles className="w-3 h-3 text-purple-400" />
                                  AI 번역 설명 (Grammar & Vocab)
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                  {activeSentence.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto justify-end">
                      <button
                        onClick={handleResetBlockGame}
                        className="px-4 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-950/50 text-xs text-zinc-300 rounded-lg transition-all hover:bg-zinc-900 cursor-pointer font-bold flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        다시 시도
                      </button>
                      {blockGameResult === 'correct' && (
                        <button
                          onClick={handleNextToTypingStage}
                          className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white text-xs font-extrabold rounded-lg transition-all shadow-[0_4px_10px_rgba(147,51,234,0.2)] flex items-center gap-1.5 cursor-pointer"
                        >
                          다음 단계
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TYPING GAME STAGE */}
            {gameState === 'typing-game' && (
              <div className="space-y-6" id="typing-game-module">
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-purple-400" />
                      직접 영어 문장 타이핑 입력
                    </label>
                    <button
                      onClick={() => setShowAnswerHint(!showAnswerHint)}
                      className="text-[11px] text-zinc-500 hover:text-purple-400 font-bold transition-all flex items-center gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showAnswerHint ? '힌트 숨기기' : '정답 단어 힌트 보기'}
                    </button>
                  </div>

                  {showAnswerHint && (
                    <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1 animate-in slide-in-from-top-2 duration-200">
                      <span className="text-[10px] font-mono text-purple-400 font-bold block uppercase tracking-wider">ANSWER HINT</span>
                      <p className="text-xs text-zinc-400 font-mono tracking-wide">{activeSentence.english}</p>
                    </div>
                  )}

                  <input
                    ref={typingRef}
                    type="text"
                    value={typingInput}
                    onChange={(e) => setTypingInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && typingInput.trim() && typingResult !== 'correct') {
                        handleCheckTyping();
                      }
                    }}
                    disabled={typingResult === 'correct'}
                    placeholder="방금 조립한 영어 문장을 직접 기입하세요..."
                    className="w-full px-4 py-3.5 bg-zinc-950/60 border border-zinc-850 rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all font-mono"
                  />
                </div>

                {/* Submits and Check */}
                {typingResult === 'none' && (
                  <button
                    onClick={handleCheckTyping}
                    disabled={!typingInput.trim()}
                    className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_12px_rgba(147,51,234,0.15)] flex items-center justify-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <Check className="w-4 h-4" />
                    작성 완료 (제출)
                  </button>
                )}

                {/* Typing Feedback */}
                {typingResult !== 'none' && (
                  <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in duration-300 ${
                    typingResult === 'correct' 
                      ? 'bg-green-950/40 border-green-900/50 text-green-300' 
                      : 'bg-red-950/40 border-red-900/50 text-red-300'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${typingResult === 'correct' ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold">
                          {typingResult === 'correct' ? '영작 영웅 탄생! 아주 잘 쓰셨습니다.' : '일치하지 않는 어휘가 있습니다.'}
                        </h4>
                        {typingResult === 'wrong' && (
                          <p className="text-[11px] opacity-80 mt-0.5">
                            스펠링이나 문장 마침표, 철자를 조절하여 다시 확인해 보세요.
                          </p>
                        )}
                        {typingResult === 'correct' && (
                          <div className="mt-2.5 p-3.5 bg-zinc-950/70 rounded-xl border border-green-500/15 space-y-3 text-left">
                            <div className="flex items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono font-bold text-emerald-500 uppercase tracking-wider block">ENGLISH (영어)</span>
                                <p className="text-xs font-bold text-emerald-400 font-mono tracking-wide">
                                  {activeSentence.english}
                                </p>
                              </div>
                              <button
                                onClick={() => playAudio(activeSentence.english)}
                                title="발음 듣기"
                                className="p-2 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/30 hover:border-purple-500 text-purple-300 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">KOREAN (해석)</span>
                              <p className="text-xs text-zinc-300">
                                {activeSentence.korean}
                              </p>
                            </div>

                            {activeSentence.explanation && (
                              <div className="space-y-1 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-800/50">
                                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider">
                                  <Sparkles className="w-3 h-3 text-purple-400" />
                                  AI 번역 설명 (Grammar & Vocab)
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                  {activeSentence.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto justify-end">
                      {typingResult === 'wrong' && (
                        <button
                          onClick={() => setTypingResult('none')}
                          className="px-4 py-2 border border-zinc-800 bg-zinc-950/50 text-xs text-zinc-300 hover:text-white rounded-lg transition-all hover:bg-zinc-900 cursor-pointer font-bold flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          다시 적기
                        </button>
                      )}
                      {typingResult === 'correct' && (
                        <button
                          onClick={handleProceedNext}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-xs font-extrabold rounded-lg transition-all shadow-[0_4px_10px_rgba(16,185,129,0.2)] flex items-center gap-1.5 cursor-pointer"
                        >
                          {currentSentenceIndex + 1 < sentencePairs.length ? (
                            <>
                              다음 문장 학습하기
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              학습 완료 및 저장하기
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STAGE 3: SUMMARY / SUCCESS SCREEN */}
      {gameState === 'summary' && (
        <div className="bg-[#111322] border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden" id="stage-summary-card">
          <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center space-y-2 py-4">
            <div className="mx-auto w-16 h-16 bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.15)] mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-zinc-100">모든 문장 학습 완료!</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              정의된 고급 DET 영작 수련 과정을 성공적으로 끝내셨습니다. 방금 학습한 문장들이 클라우드 데이터베이스에 누적 저장되었습니다.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-bold block">
              오늘의 영작 성과 보고서 (고급 DET 120 레벨)
            </span>
            <div className="border border-zinc-900 rounded-xl overflow-hidden bg-zinc-950/30 divide-y divide-zinc-950">
              {sentencePairs.map((pair, idx) => (
                <div key={`summary-${idx}`} className="p-4 space-y-2">
                  <div className="flex items-start gap-2.5 justify-between">
                    <div className="flex items-start gap-2.5 flex-1">
                      <span className="w-5 h-5 bg-zinc-900 text-zinc-500 font-mono text-[10px] font-bold rounded flex items-center justify-center mt-0.5 border border-zinc-850">
                        {idx + 1}
                      </span>
                      <div className="space-y-1 flex-1">
                        <p className="text-xs font-semibold text-zinc-400">{pair.korean}</p>
                        <p className="text-xs font-mono font-bold text-purple-400 leading-relaxed tracking-wide">{pair.english}</p>
                        {pair.explanation && (
                          <p className="text-[11px] text-zinc-500 leading-relaxed pt-1 border-t border-zinc-900 mt-1">
                            {pair.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => playAudio(pair.english)}
                      title="발음 듣기"
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white rounded transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-2.5 justify-end">
            <button
              onClick={handleRestartPractice}
              className="w-full sm:w-auto px-6 py-2.5 border border-zinc-800 bg-zinc-950/40 text-xs text-zinc-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:bg-zinc-900/60 font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              새로운 문단 연습하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
