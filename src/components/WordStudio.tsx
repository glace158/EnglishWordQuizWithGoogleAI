/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Plus, 
  Download, 
  Trash2, 
  FileSpreadsheet, 
  Sparkles, 
  AlertCircle, 
  Check, 
  Search, 
  RefreshCw, 
  X,
  Volume2,
  Play,
  Database,
  CloudLightning,
  ChevronUp,
  ChevronDown,
  Edit2,
  FolderPlus,
  GripVertical
} from 'lucide-react';
import { WordItem, isWeakWord, WordList } from '../types';
import { speakText } from '../utils/tts';

interface WordStudioProps {
  words: WordItem[];
  onWordsChange: (newWords: WordItem[]) => void;
  voiceName: string;
  onStartQuiz?: (wordId: string) => void;
  weakThreshold?: number;
  onWeakThresholdChange?: (val: number) => void;
  lists?: WordList[];
  onListsChange?: (newLists: WordList[]) => void;
  activeListId?: string;
  onActiveListIdChange?: (id: string) => void;
}

export function WordStudio({ 
  words, 
  onWordsChange, 
  voiceName, 
  onStartQuiz, 
  weakThreshold = 80, 
  onWeakThresholdChange,
  lists = [],
  onListsChange,
  activeListId,
  onActiveListIdChange
}: WordStudioProps) {
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [filterWeakOnly, setFilterWeakOnly] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  
  // Manual word entry state
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newSentence, setNewSentence] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [isAddingManually, setIsAddingManually] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supabase Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ configured: boolean; url?: string } | null>(null);

  // Custom dialog/alert state to replace iframe-blocked alert/confirm
  const [customDialog, setCustomDialog] = useState<{
    type: 'confirm' | 'alert';
    title: string;
    message: string;
    suggestion?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

  // Fetch Supabase status on mount
  React.useEffect(() => {
    fetch('/api/supabase/status')
      .then(res => res.json())
      .then(data => setDbStatus(data))
      .catch(err => console.error('Error fetching Supabase status:', err));
  }, []);

  const saveToSupabase = () => {
    const activeList = lists.find(l => l.id === activeListId);
    const listName = activeList ? activeList.name : '기본 단어장';

    setCustomDialog({
      type: 'confirm',
      title: 'Supabase 클라우드 백업',
      message: `현재 선택된 단어장 "${listName}"의 단어들을 Supabase 클라우드 데이터베이스에 백업하시겠습니까?\n(이전에 이 단어장 이름으로 백업된 데이터는 현재 상태로 덮어씌워집니다.)`,
      onConfirm: () => {
        setCustomDialog(null);
        executeSaveToSupabase(listName);
      }
    });
  };

  const executeSaveToSupabase = async (listName: string) => {
    if (words.length === 0) {
      showNotification('error', '저장할 단어가 없습니다. 단어를 등록한 후에 동기화하세요!');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch('/api/supabase/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          words,
          listId: activeListId,
          listName: listName
        }),
      });
      const data = await response.json();
      if (data.success) {
        showNotification('success', `성공적으로 "${listName}" 단어장의 ${data.count}개 단어를 Supabase에 동기화하였습니다!`);
      } else {
        if (data.error === 'SUPABASE_NOT_CONFIGURED') {
          showNotification('error', 'Supabase 환경 변수가 설정되지 않았습니다. .env 환경 파일 설정을 먼저 확인해 주세요.');
        } else if (data.error === 'MISSING_LIST_COLUMNS') {
          setCustomDialog({
            type: 'alert',
            title: '데이터베이스 컬럼 미설정',
            message: data.message,
            suggestion: data.suggestion,
            onConfirm: () => setCustomDialog(null)
          });
        } else {
          showNotification('error', data.message || 'Supabase에 저장하는 동안 오류가 발생했습니다.');
        }
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Supabase 서버 연결 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const loadFromSupabase = () => {
    const activeList = lists.find(l => l.id === activeListId);
    const listName = activeList ? activeList.name : '기본 단어장';

    setCustomDialog({
      type: 'confirm',
      title: 'Supabase 클라우드 데이터 로드',
      message: `Supabase 클라우드에서 현재 선택된 단어장 "${listName}"의 백업 데이터를 가져오시겠습니까?\n\n(주의: 현재 단어장의 로컬 데이터가 클라우드 백업 데이터로 대체됩니다.)`,
      onConfirm: () => {
        setCustomDialog(null);
        executeLoadFromSupabase(listName);
      }
    });
  };

  const executeLoadFromSupabase = async (listName: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/supabase/load?list_id=${activeListId}`);
      const data = await response.json();
      if (data.success) {
        const cloudList = data.lists?.find((l: any) => l.id === activeListId);
        if (cloudList) {
          const cloudWords = cloudList.words || [];
          onWordsChange(cloudWords);
          showNotification('success', `Supabase 클라우드에서 "${listName}" 단어장의 백업 데이터(${cloudWords.length}개)를 성공적으로 가져왔습니다!`);
        } else if (data.words && data.words.length > 0) {
          onWordsChange(data.words);
          showNotification('success', `Supabase 클라우드에서 "${listName}" 단어장의 백업 데이터(${data.words.length}개)를 성공적으로 가져왔습니다!`);
        } else {
          showNotification('info', `Supabase 클라우드에 "${listName}" 단어장의 백업 데이터가 존재하지 않습니다.`);
        }
      } else {
        if (data.error === 'SUPABASE_NOT_CONFIGURED') {
          showNotification('error', 'Supabase 환경 변수가 설정되지 않았습니다. .env 환경 파일 설정을 먼저 확인해 주세요.');
        } else if (data.error === 'MISSING_LIST_COLUMNS') {
          setCustomDialog({
            type: 'alert',
            title: '데이터베이스 컬럼 미설정',
            message: data.message,
            suggestion: data.suggestion,
            onConfirm: () => setCustomDialog(null)
          });
        } else {
          showNotification('error', data.message || 'Supabase에서 단어를 로드하는 데 실패했습니다.');
        }
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Supabase 서버 연결 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Robust CSV parser supporting quotes, internal commas/newlines, and gracefully handling unbalanced quotes per line
  const parseCSV = (text: string): string[][] => {
    const rawLines = text.split(/\r?\n/);
    const parsedRows: string[][] = [];

    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line) continue;

      const fields: string[] = [];
      let currentField = "";
      let inQuotes = false;

      // Helper to check if a quote at a given index is a real closing quote
      const isRealCloseQuote = (index: number): boolean => {
        // Skip subsequent whitespaces and check if the next character is a comma or the end of the line
        for (let j = index + 1; j < line.length; j++) {
          if (line[j] === ' ' || line[j] === '\t') continue;
          return line[j] === ',';
        }
        return true; // End of line is a valid closing quote position
      };

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (!inQuotes) {
            // Opening quote candidate: only if the current field being accumulated is blank
            if (currentField.trim() === "") {
              inQuotes = true;
            } else {
              currentField += char;
            }
          } else {
            // Closing quote candidate: must be followed by a comma, spaces then comma, or end of line
            if (isRealCloseQuote(i)) {
              inQuotes = false;
            } else {
              // Standard escaped quote ("") check
              if (i + 1 < line.length && line[i + 1] === '"') {
                currentField += '"';
                i++; // Skip the next quote character
              } else {
                currentField += char;
              }
            }
          }
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField);
          currentField = "";
        } else {
          currentField += char;
        }
      }
      fields.push(currentField);

      // Clean up surrounding quotes and whitespaces from each parsed field
      const cleanRow = fields.map(f => {
        let trimmed = f.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
          trimmed = trimmed.substring(1, trimmed.length - 1);
        }
        return trimmed.trim();
      });

      if (cleanRow.length > 0 && cleanRow.some(f => f !== '')) {
        parsedRows.push(cleanRow);
      }
    }

    return parsedRows;
  };

  // Handle uploaded files
  const handleCSVFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      showNotification('error', 'Only standard CSV (.csv) files are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          showNotification('error', 'The file appears to be empty.');
          return;
        }

        const rawRows = parseCSV(text);
        if (rawRows.length < 2) {
          showNotification('error', 'Insufficient rows in CSV (must contain at least a header row and one word row).');
          return;
        }

        // Parse headers to match index dynamically
        const headers = rawRows[0].map(h => h.trim().toLowerCase());
        
        const wordIdx = headers.indexOf('word');
        const meaningIdx = headers.indexOf('meaning');
        const sentenceIdx = headers.indexOf('sentence');
        const transIdx = headers.indexOf('sentence_translation');

        if (wordIdx === -1 || meaningIdx === -1) {
          showNotification('error', 'CSV must at least contain "word" and "meaning" headers.');
          return;
        }

        const importedItems: WordItem[] = [];
        let duplicateCount = 0;

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          // Skip empty or short rows
          if (row.length <= Math.max(wordIdx, meaningIdx) || !row[wordIdx]?.trim()) {
            continue;
          }

          const wordVal = row[wordIdx].trim();
          const meaningVal = row[meaningIdx].trim();
          const sentenceVal = sentenceIdx !== -1 && row[sentenceIdx] ? row[sentenceIdx].trim() : '';
          const transVal = transIdx !== -1 && row[transIdx] ? row[transIdx].trim() : '';

          const exists = words.some(w => 
            w.word.toLowerCase() === wordVal.toLowerCase() && 
            w.sentence.trim().toLowerCase() === sentenceVal.trim().toLowerCase()
          );

          if (exists) {
            duplicateCount++;
            continue;
          }

          importedItems.push({
            id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${i}`,
            word: wordVal,
            meaning: meaningVal,
            sentence: sentenceVal,
            sentence_translation: transVal,
            attempts: 0,
            correctCount: 0,
            mastered: false
          });
        }

        if (importedItems.length === 0) {
          if (duplicateCount > 0) {
            showNotification('info', `All ${duplicateCount} words in the CSV already exist in your deck.`);
          } else {
            showNotification('error', 'No valid rows could be imported from the CSV.');
          }
          return;
        }

        const mergedList = [...words, ...importedItems];
        onWordsChange(mergedList);
        
        let msg = `Successfully imported ${importedItems.length} new words!`;
        if (duplicateCount > 0) {
          msg += ` (${duplicateCount} existing duplicates skipped)`;
        }
        showNotification('success', msg);

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (err) {
        console.error('Error parsing CSV', err);
        showNotification('error', 'Failed to process CSV file. Ensure it is correctly formatted.');
      }
    };

    reader.readAsText(file);
  };

  // Drag-and-drop triggers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || !newMeaning.trim()) {
      showNotification('error', 'Word and Meaning fields are required.');
      return;
    }

    // Check pre-existence
    const exists = words.some(w => w.word.toLowerCase() === newWord.trim().toLowerCase());
    if (exists) {
      showNotification('error', `"${newWord.trim()}" is already present in your word deck.`);
      return;
    }

    const item: WordItem = {
      id: `usr-man-${Date.now()}`,
      word: newWord.trim(),
      meaning: newMeaning.trim(),
      sentence: newSentence.trim(),
      sentence_translation: newTranslation.trim(),
      attempts: 0,
      correctCount: 0,
      mastered: false,
    };

    onWordsChange([...words, item]);
    showNotification('success', `"${newWord.trim()}" successfully added!`);

    // Reset input fields
    setNewWord('');
    setNewMeaning('');
    setNewSentence('');
    setNewTranslation('');
    setIsAddingManually(false);
  };

  // Move word up or down in the list
  const moveWord = (id: string, direction: 'UP' | 'DOWN') => {
    const index = words.findIndex(w => w.id === id);
    if (index === -1) return;
    
    const newWords = [...words];
    if (direction === 'UP' && index > 0) {
      const temp = newWords[index];
      newWords[index] = newWords[index - 1];
      newWords[index - 1] = temp;
    } else if (direction === 'DOWN' && index < words.length - 1) {
      const temp = newWords[index];
      newWords[index] = newWords[index + 1];
      newWords[index + 1] = temp;
    }
    onWordsChange(newWords);
  };

  const handleDropWord = (targetId: string) => {
    if (!draggedItemId || draggedItemId === targetId) {
      setDragOverItemId(null);
      return;
    }

    const indexDrag = words.findIndex(w => w.id === draggedItemId);
    const indexTarget = words.findIndex(w => w.id === targetId);
    if (indexDrag === -1 || indexTarget === -1) {
      setDragOverItemId(null);
      return;
    }

    const newWords = [...words];
    const [draggedItem] = newWords.splice(indexDrag, 1);
    newWords.splice(indexTarget, 0, draggedItem);

    onWordsChange(newWords);
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const handleCreateNewList = () => {
    const name = prompt('새 단어장의 이름을 입력해 주세요:', `새 단어장 ${lists.length + 1}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      showNotification('error', '단어장 이름은 비워둘 수 없습니다.');
      return;
    }
    
    if (lists.some(l => l.name.toLowerCase() === trimmed.toLowerCase())) {
      showNotification('error', '이미 같은 이름의 단어장이 존재합니다.');
      return;
    }

    const newListId = `list-${Date.now()}`;
    const newList: WordList = {
      id: newListId,
      name: trimmed,
      words: []
    };

    const updated = [...lists, newList];
    onListsChange?.(updated);
    onActiveListIdChange?.(newListId);
    showNotification('success', `"${trimmed}" 단어장이 새로 생성되었습니다.`);
  };

  const handleRenameCurrentList = () => {
    const currentList = lists.find(l => l.id === activeListId);
    if (!currentList) return;

    const newName = prompt('단어장의 새 이름을 입력해 주세요:', currentList.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      showNotification('error', '단어장 이름은 비워둘 수 없습니다.');
      return;
    }

    if (trimmed === currentList.name) return;

    if (lists.some(l => l.id !== activeListId && l.name.toLowerCase() === trimmed.toLowerCase())) {
      showNotification('error', '이미 같은 이름의 단어장이 존재합니다.');
      return;
    }

    const updated = lists.map(l => {
      if (l.id === activeListId) {
        return { ...l, name: trimmed };
      }
      return l;
    });
    onListsChange?.(updated);
    showNotification('success', `단어장 이름이 "${trimmed}"(으)로 변경되었습니다.`);
  };

  const handleDeleteCurrentList = () => {
    const currentList = lists.find(l => l.id === activeListId);
    if (!currentList) return;

    if (lists.length <= 1) {
      showNotification('error', '최소 하나의 단어장은 유지해야 합니다.');
      return;
    }

    const confirmDel = window.confirm(`정말로 현재 단어장 "${currentList.name}"을(를) 삭제하시겠습니까? 단어장 안의 모든 단어가 삭제됩니다.`);
    if (!confirmDel) return;

    const remainingLists = lists.filter(l => l.id !== activeListId);
    const fallbackId = remainingLists[0].id;
    
    onActiveListIdChange?.(fallbackId);
    onListsChange?.(remainingLists);
    showNotification('info', `"${currentList.name}" 단어장이 삭제되었습니다.`);
  };

  // Delete specific target word
  const deleteWord = (id: string, name: string) => {
    const updated = words.filter(w => w.id !== id);
    onWordsChange(updated);
    showNotification('info', `"${name}" removed from deck.`);
  };

  // Clear all words
  const clearAllWords = () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 4000);
      return;
    }
    setShowClearConfirm(false);
    onWordsChange([]);
    showNotification('info', 'All words have been cleared.');
  };

  // Reset to sample defaults
  const resetToSamples = () => {
    if (!showRestoreConfirm) {
      setShowRestoreConfirm(true);
      setTimeout(() => setShowRestoreConfirm(false), 4000);
      return;
    }
    setShowRestoreConfirm(false);
    // Import template
    const template: WordItem[] = [
      {
        id: 'default-1',
        word: 'able',
        meaning: '~할 수 있는',
        sentence: 'With practice, you will be able to play the piano.',
        sentence_translation: '연습하면, 당신은 피아노를 칠 수 있게 될 것입니다.',
        attempts: 0,
        correctCount: 0,
        mastered: false,
      },
      {
        id: 'default-2',
        word: 'academic',
        meaning: '학문적인',
        sentence: 'She has an excellent academic record.',
        sentence_translation: '그녀는 우수한 학업 성적을 가지고 있습니다.',
        attempts: 0,
        correctCount: 0,
        mastered: false,
      },
      {
        id: 'default-3',
        word: 'accordance',
        meaning: '일치; 조화',
        sentence: 'All activities must be in accordance with the law.',
        sentence_translation: '모든 활동은 법률에 따라야 합니다.',
        attempts: 0,
        correctCount: 0,
        mastered: false,
      },
      {
        id: 'default-4',
        word: 'ache',
        meaning: '아픔; 쑤시다',
        sentence: 'I have a dull ache in my lower back.',
        sentence_translation: '허리 아래쪽에 둔한 통증이 있어요.',
        attempts: 0,
        correctCount: 0,
        mastered: false,
      },
      {
        id: 'default-5',
        word: 'acquire',
        meaning: '얻다; 습득하다',
        sentence: 'He worked hard to acquire new skills for his job.',
        sentence_translation: '그는 직업을 위해 새로운 기술을 습득하기 위해 열심히 일했습니다.',
        attempts: 0,
        correctCount: 0,
        mastered: false,
      },
      {
        id: 'default-6',
        word: 'act',
        meaning: '행동하다; 행위',
        sentence: "It's time to act and make a decision.",
        sentence_translation: '이제 행동하고 결정을 내릴 시간입니다.',
        attempts: 0,
        correctCount: 0,
        mastered: false,
      }
    ];
    onWordsChange(template);
    showNotification('success', '기본 제공 영어 단어장으로 성공적으로 수복되었습니다.');
  };

  // Helper: Trigger custom CSV spreadsheet file generation
  const downloadSampleCSV = () => {
    const csvContent = 
      "word,meaning,sentence,sentence_translation\n" +
      "able,~할 수 있는,\"With practice, you will be able to play the piano.\",\"연습하면, 당신은 피아노를 칠 수 있게 될 것입니다.\"\n" +
      "academic,학문적인,\"She has an excellent academic record.\",\"그녀는 우수한 학업 성적을 가지고 있습니다.\"\n" +
      "accordance,\"일치; 조화\",\"All activities must be in accordance with the law.\",\"모든 활동은 법률에 따라야 합니다.\"\n" +
      "ache,\"아픔; 쑤시다\",\"I have a dull ache in my lower back.\",\"허리 아래쪽에 둔한 통증이 있어요.\"\n" +
      "acquire,\"얻다; 습득하다\",\"He worked hard to acquire new skills for his job.\",\"그는 직업을 위해 새로운 기술을 습득하기 위해 열심히 일했습니다.\"\n" +
      "act,\"행동하다; 행위\",\"It's time to act and make a decision.\",\"이제 행동하고 결정을 내릴 시간입니다.\"";

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "vocamaster_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('success', 'Download started! Open this template in Excel/Sheets to populate your own words.');
  };

  // Filter word lists
  const filteredWords = words.filter(w => {
    if (filterWeakOnly && !isWeakWord(w, weakThreshold)) return false;
    const q = searchTerm.toLowerCase().trim();
    return w.word.toLowerCase().includes(q) || 
           w.meaning.toLowerCase().includes(q) || 
           w.sentence.toLowerCase().includes(q) || 
           w.sentence_translation.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="word-studio-root">
      
      {/* Visual notification banner */}
      {notification && (
        <div 
          className={`flex items-center gap-3 p-4 rounded-xl text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            notification.type === 'success' ? 'bg-green-950/80 border border-green-500/30 text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.1)]' :
            notification.type === 'error' ? 'bg-red-950/80 border border-red-500/30 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.1)]' :
            'bg-zinc-900 border border-zinc-700 text-zinc-300'
          }`}
          role="alert"
          id="toast-notification"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 animate-bounce" />
          <p className="font-medium flex-1">{notification.message}</p>
          <button 
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CSV Import card & Management instructions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CSV Drop uploader box */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all duration-300 min-h-[220px] ${
            dragActive 
              ? 'border-[#7C3AED] bg-[#7C3AED]/10 shadow-[0_0_20px_rgba(124,58,237,0.2)]' 
              : 'border-zinc-800 bg-[#11131E]/30 hover:border-zinc-700 hover:bg-[#11131E]/50'
          }`}
          id="csv-drag-area"
        >
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleCSVFile(e.target.files[0]);
              }
            }}
            className="hidden" 
            id="csv-input-hidden"
          />

          <div className="p-4 bg-zinc-900/80 rounded-full border border-zinc-800 text-purple-400 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8 animate-pulse" />
          </div>

          <p className="mt-4 text-center text-sm font-medium text-zinc-200">
            CSV 파일을 드래그하여 놓거나 클릭하여 업로드하세요
          </p>
          <p className="mt-2 text-xs text-zinc-500 text-center">
            UTF-8 형식의 CSV 파일 지원 (word, meaning, sentence, sentence_translation 순서)
          </p>

          <div className="mt-5 flex gap-2 flex-wrap justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs bg-zinc-900 text-zinc-300 rounded-lg font-medium border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors"
              id="upload-select-btn"
            >
              파일 탐색
            </button>
            <button
              onClick={downloadSampleCSV}
              className="px-4 py-2 text-xs bg-[#7C3AED]/25 text-[#D946EF] border border-[#7C3AED]/40 hover:bg-[#7C3AED]/40 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
              id="download-template-btn"
            >
              <Download className="w-3.5 h-3.5" />
              샘플 템플릿 받기
            </button>
          </div>
        </div>

        {/* Studio operations guide & Quick Manual Insert toggle */}
        <div className="bg-[#11131E]/60 border border-zinc-850 rounded-2xl p-6 flex flex-col justify-between" id="instructions-card">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold tracking-wider uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Word Studio Desk</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-100">나만의 단어장을 구축해 보세요</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              사용자 지정 영어 단어, 뜻, 예문, 예문 한글 번역이 들어간 CSV 파일을 업로드하여 외울 수 있습니다. 업로드할 CSV 파일 첫 줄에는 반드시 아래와 같이 헤더가 정의되어야 합니다:
            </p>
            <code className="block text-[11px] font-mono text-zinc-300 bg-black/60 p-2 rounded-lg border border-zinc-850">
              word,meaning,sentence,sentence_translation
            </code>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-900 flex flex-col sm:flex-row gap-2 sm:gap-2.5 justify-end">
            <button
              onClick={() => setIsAddingManually(!isAddingManually)}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#7C3AED] to-[#D946EF] hover:from-[#6D28D9] hover:to-[#C084FC] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-[0_4px_12px_rgba(124,58,237,0.2)] transition-all"
              id="add-manually-toggle-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAddingManually ? '수동 입력 창 닫기' : '단어 직접 입력하기'}
            </button>
            <button
              onClick={resetToSamples}
              className={`w-full sm:w-auto px-3 py-2 text-xs border rounded-xl transition-all ${
                showRestoreConfirm
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/60 animate-pulse'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
              id="restore-defaults-btn"
              title="기존 6개 샘플 단어로 초기화"
            >
              {showRestoreConfirm ? '정말 복구할까요? (한번 더 클릭)' : '기본 제공단어로 복구'}
            </button>
          </div>
        </div>
      </div>

      {/* Manual Word Addition Form */}
      {isAddingManually && (
        <form 
          onSubmit={handleManualSubmit}
          className="bg-[#131525] border border-purple-500/25 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-4 duration-300"
          id="manual-add-form"
        >
          <div className="flex justify-between items-center pb-2 border-b border-zinc-850">
            <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-purple-400" />
              단어 수동 추가
            </h4>
            <button 
              type="button"
              onClick={() => setIsAddingManually(false)}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">영어 단어 (Word) <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="예: explore"
                className="w-full bg-[#0E1018] rounded-xl border border-zinc-800 text-zinc-200 text-sm p-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">뜻 (Meaning) <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required
                value={newMeaning}
                onChange={(e) => setNewMeaning(e.target.value)}
                placeholder="예: 탐험하다, 탐구하다"
                className="w-full bg-[#0E1018] rounded-xl border border-zinc-800 text-zinc-200 text-sm p-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">예문 (English Sentence) <span className="text-zinc-500">(선택)</span></label>
              <input 
                type="text" 
                value={newSentence}
                onChange={(e) => setNewSentence(e.target.value)}
                placeholder="예: We decided to explore the mysterious island."
                className="w-full bg-[#0E1018] rounded-xl border border-zinc-800 text-zinc-200 text-sm p-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">예문 번역 (Sentence Translation) <span className="text-zinc-500">(선택)</span></label>
              <input 
                type="text" 
                value={newTranslation}
                onChange={(e) => setNewTranslation(e.target.value)}
                placeholder="예: 우리는 그 신비로운 섬을 탐험하기로 결정했습니다."
                className="w-full bg-[#0E1018] rounded-xl border border-zinc-800 text-zinc-200 text-sm p-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingManually(false)}
              className="px-4 py-2 rounded-xl text-xs bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:brightness-110 text-white font-bold transition-all"
            >
              저장하기
            </button>
          </div>
        </form>
      )}

      {/* Supabase Sync Controller */}
      <div 
        className="bg-[#11131D]/50 border border-zinc-900 rounded-2xl p-5 md:p-6 space-y-4 shadow-lg relative overflow-hidden" 
        id="supabase-sync-card"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-gradient-to-br from-purple-950/40 to-fuchsia-950/40 text-[#A855F7] border border-purple-900/30 rounded-xl flex-shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-zinc-100">Supabase 클라우드 동기화</h4>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0E1018] border border-zinc-850">
                  <span className={`w-1.5 h-1.5 rounded-full ${dbStatus?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {dbStatus?.configured ? '연결됨' : '미연결'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
                작성한 단어장 덱을 Supabase 데이터베이스에 업로드 및 동기화하거나 언제든지 불러올 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={saveToSupabase}
              disabled={isSyncing}
              className="flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CloudLightning className="w-3.5 h-3.5" />
              {isSyncing ? '동기화 중...' : 'Supabase에 백업'}
            </button>
            <button
              onClick={loadFromSupabase}
              disabled={isSyncing}
              className="flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              가져오기
            </button>
          </div>
        </div>
      </div>

      {/* Word list view control & Search panel */}
      <div className="bg-[#11131E]/40 border border-zinc-900 rounded-2xl" id="word-manager-deck shadow-xl">
        <div className="p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-center justify-between border-b border-zinc-900 bg-[#111320]/60 rounded-t-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-[#8B5CF6] flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-zinc-200">현재 보카 덱 단어 리스트</h3>
                <p className="text-[11px] text-zinc-500">총 {words.length}개의 단어가 등록되어 있습니다.</p>
              </div>
            </div>

            {/* List Selector and Tools */}
            <div className="flex items-center gap-1.5 ml-0 sm:ml-4 flex-wrap">
              <select
                value={activeListId}
                onChange={(e) => onActiveListIdChange?.(e.target.value)}
                className="bg-[#0E1018] text-xs py-1.5 px-3 rounded-xl border border-zinc-850 text-zinc-200 font-bold focus:outline-none focus:ring-1 focus:ring-purple-600 cursor-pointer"
                id="select-word-list"
              >
                {lists.filter(list => list.id !== 'ai-english-practice-list').map(list => (
                  <option key={list.id} value={list.id} className="bg-zinc-950 text-zinc-200">
                    {list.name} ({list.words.length}개)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleCreateNewList}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-zinc-400 hover:text-purple-400 rounded-xl transition-all cursor-pointer"
                title="새 단어장 추가"
                id="create-list-btn"
              >
                <FolderPlus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleRenameCurrentList}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-zinc-400 hover:text-amber-400 rounded-xl transition-all cursor-pointer"
                title="현재 단어장 이름 변경"
                id="rename-list-btn"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              {lists.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteCurrentList}
                  className="p-1.5 bg-red-950/20 hover:bg-red-950/45 border border-red-950/40 text-red-400 hover:text-red-350 rounded-xl transition-all cursor-pointer"
                  title="현재 단어장 삭제"
                  id="delete-list-btn"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="단어, 뜻, 예무 검색..."
                className="w-full bg-[#0A0C14] text-xs py-2 pl-9 pr-4 rounded-xl border border-zinc-850 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setFilterWeakOnly(!filterWeakOnly)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap border flex items-center justify-center gap-1.5 ${
                  filterWeakOnly
                    ? 'bg-[#3b2ff2] text-white border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)] font-extrabold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
                title="자주 틀리는 단어 리스트만 모아보기"
                id="filter-weak-words-btn"
              >
                <AlertCircle className={`w-3.5 h-3.5 ${filterWeakOnly ? 'text-amber-300' : 'text-zinc-500'}`} />
                <span>자주 틀리는 단어 ({words.filter(w => isWeakWord(w, weakThreshold)).length})</span>
              </button>

              {onWeakThresholdChange && (
                <div className="flex items-center gap-2 bg-[#111320] border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400" title="취약 단어 분류 기준 (정답률 이하)">
                  <span className="text-[11px] text-zinc-500">기준:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weakThreshold}
                    onChange={(e) => onWeakThresholdChange(Number(e.target.value))}
                    className="w-16 sm:w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    id="select-weak-threshold"
                  />
                  <span className="text-amber-300 font-bold whitespace-nowrap">≤ {weakThreshold}%</span>
                </div>
              )}
            </div>

            <button
              onClick={clearAllWords}
              disabled={words.length === 0}
              className={`p-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 text-xs w-full sm:w-auto ${
                showClearConfirm 
                  ? 'bg-red-950/80 text-red-300 border border-red-500/50 hover:bg-red-900/60 animate-pulse'
                  : 'bg-red-950/20 text-red-400 hover:text-red-300 disabled:opacity-40 hover:bg-red-950/40 border border-red-950/40'
              }`}
              title="단어장 전체 비우기"
              id="clear-all-deck-btn"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              {showClearConfirm && <span className="font-semibold pr-1">정말 비울까요?</span>}
              {!showClearConfirm && <span className="sm:hidden">비우기</span>}
            </button>
          </div>
        </div>

        {/* Dense Table Listing of Vocabs */}
        <div className="overflow-x-auto" id="word-table-container">
          {filteredWords.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-7 h-7 text-zinc-600" />
              <p>{searchTerm || filterWeakOnly ? '검색 필터나 조건에 일치하는 단어가 없습니다.' : '단어가 비어 있습니다. CSV 파일을 업로드하여 채우세요!'}</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-[#090B12]/80 text-zinc-400 font-medium tracking-wide uppercase">
                  <th className="py-3 px-2 sm:px-4 w-12 text-center">순서</th>
                  <th className="py-3 px-2 sm:px-4">단어 (Word)</th>
                  <th className="py-3 px-2 sm:px-4">의미 (Meaning)</th>
                  <th className="py-3 px-2 sm:px-4 hidden md:table-cell">예문 & 한글 번역</th>
                  <th className="py-3 px-2 sm:px-4 text-center">정답률 / 시도횟수</th>
                  <th className="py-3 px-2 sm:px-4 text-center">학습</th>
                  <th className="py-3 px-2 sm:px-4 text-right">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/50">
                {filteredWords.map((item) => {
                  const accuracy = item.attempts > 0 ? Math.round((item.correctCount / item.attempts) * 100) : 0;
                  return (
                    <tr 
                      key={item.id} 
                      draggable
                      onDragStart={(e) => {
                        setDraggedItemId(item.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDragEnter={() => setDragOverItemId(item.id)}
                      onDragEnd={() => {
                        setDraggedItemId(null);
                        setDragOverItemId(null);
                      }}
                      onDrop={() => handleDropWord(item.id)}
                      className={`group transition-all text-zinc-300 border-l-2 select-none ${
                        draggedItemId === item.id 
                          ? 'opacity-30 bg-zinc-950/60 border-l-purple-500/10' 
                          : dragOverItemId === item.id
                          ? 'bg-purple-950/40 border-l-purple-500 shadow-[inset_0_0_10px_rgba(147,51,234,0.15)] scale-[0.995]' 
                          : 'hover:bg-zinc-800/10 border-l-transparent'
                      }`}
                      id={`row-${item.id}`}
                    >
                      <td className="py-2 px-1 sm:px-2 text-center w-12 text-zinc-600 group-hover:text-purple-400 transition-colors">
                        <div className="flex items-center justify-center cursor-grab active:cursor-grabbing" title="드래그하여 순서 변경">
                          <GripVertical className="w-4 h-4" />
                        </div>
                      </td>
                      <td className="py-3 px-2 sm:px-4 font-bold text-zinc-100 font-mono tracking-wide">
                        <div className="flex items-center gap-2">
                          <span>{item.word}</span>
                          <button
                            onClick={() => speakText(item.word, voiceName)}
                            className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all"
                            title="발음 듣기"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-zinc-300 font-medium">
                        {item.meaning ? item.meaning.split(';').map(m => m.trim()).filter(Boolean).join(', ') : ''}
                      </td>
                      <td className="py-3 px-2 sm:px-4 max-w-xs md:max-w-md hidden md:table-cell text-zinc-400">
                        {item.sentence ? (
                          <div className="space-y-0.5">
                            <p className="italic text-zinc-300">
                              "{item.sentence.split(';').map(s => s.trim()).filter(Boolean).join(', ')}"
                            </p>
                            {item.sentence_translation && (
                              <p className="text-[10px] text-zinc-500">
                                {item.sentence_translation.split(';').map(t => t.trim()).filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-650 italic text-[11px]">- 예문 없음 -</span>
                        )}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-center">
                        {item.attempts > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className={`font-semibold ${accuracy >= 80 ? 'text-green-400' : accuracy >= 50 ? 'text-yellow-500' : 'text-zinc-400'}`}>
                              {accuracy}%
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              ({item.correctCount}/{item.attempts})
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-650 italic">미로그</span>
                        )}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-center">
                        <button
                          onClick={() => onStartQuiz?.(item.id)}
                          className="p-1.5 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 cursor-pointer inline-flex items-center justify-center gap-1 font-semibold text-[11px] transition-all"
                          title={`"${item.word}" 단어부터 학습 시작`}
                        >
                          <Play className="w-3.5 h-3.5 fill-purple-400/30" />
                          <span>시작</span>
                        </button>
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-right">
                        <button
                          onClick={() => deleteWord(item.id, item.word)}
                          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          title={`"${item.word}" 단어 삭제`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Custom Dialog Modal */}
      {customDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          id="custom-dialog-overlay"
        >
          <div 
            className="bg-[#111322] border border-zinc-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
            id="custom-dialog-box"
          >
            {/* Header */}
            <div className="p-5 border-b border-zinc-900 flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-400" />
                {customDialog.title}
              </h3>
              {customDialog.type === 'alert' && (
                <button 
                  onClick={() => setCustomDialog(null)}
                  className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                {customDialog.message}
              </div>

              {customDialog.suggestion && (
                <div className="bg-black/60 p-4 rounded-xl border border-zinc-850 space-y-2">
                  <span className="text-[10px] font-mono tracking-wider text-purple-400 uppercase font-bold block">
                    [권장 조치 - SQL 실행]
                  </span>
                  <pre className="text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap select-all">
                    {customDialog.suggestion}
                  </pre>
                  <span className="text-[9px] text-zinc-500 block">
                    💡 위 상자를 클릭하거나 드래그하여 SQL을 쉽게 복사할 수 있습니다.
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-zinc-900 flex gap-2 justify-end bg-zinc-950/40">
              {customDialog.type === 'confirm' && (
                <button
                  onClick={() => {
                    if (customDialog.onCancel) {
                      customDialog.onCancel();
                    }
                    setCustomDialog(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors font-medium cursor-pointer"
                >
                  취소
                </button>
              )}
              <button
                onClick={customDialog.onConfirm}
                className="px-5 py-2 rounded-xl text-xs bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:brightness-110 text-white font-bold transition-all shadow-[0_4px_12px_rgba(147,51,234,0.15)] cursor-pointer"
              >
                {customDialog.type === 'confirm' ? '확인' : '닫기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
