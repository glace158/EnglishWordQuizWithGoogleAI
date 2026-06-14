
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Word, Wordbook } from '../types';
import { INITIAL_WORDS } from '../constants';
import { hashString } from '../utils/crypto';

const getEnv = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key] as string;
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) return metaEnv[key];
  } catch (e) {}
  return (window as any)?.__env__?.[key] || "";
};

const RAW_URL = getEnv('VITE_SUPABASE_URL');
const PROJECT_URL = (RAW_URL && !RAW_URL.startsWith('http')) ? `https://${RAW_URL}` : RAW_URL;
const SQL_API_KEY = getEnv('VITE_SUPABASE_ANON_KEY');
const SQL_DATA_URL = PROJECT_URL ? `${PROJECT_URL}/rest/v1/word_data` : "";

const workerCode = `
  self.onmessage = function(e) {
    const { data } = e.data;
    try {
      const json = JSON.stringify(data);
      self.postMessage({ json });
    } catch (err) {
      self.postMessage({ error: err.message });
    }
  };
`;

export const useWordData = () => {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [activeBookId, setActiveBookId] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncId, setSyncId] = useState<string>('');
  const [syncPassword, setSyncPassword] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e) => {
      if (e.data.json) localStorage.setItem('voca_wordbooks_v2', e.data.json);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const normalizeWords = useCallback((inputWords: Word[]): Word[] => {
    return inputWords.map(w => ({
      ...w,
      kr: w.kr?.replace(/[;/]/g, ',') || '',
      interval: w.interval ?? 0,
      easiness: w.easiness ?? 2.5,
      repetitions: w.repetitions ?? 0,
      nextReview: w.nextReview ?? Date.now()
    }));
  }, []);

  // 현재 활성화된 단어장의 단어들
  const words = useMemo(() => {
    const active = wordbooks.find(b => b.id === activeBookId);
    return active ? active.words : [];
  }, [wordbooks, activeBookId]);

  // App.tsx 등에서 기존과 동일한 인터페이스로 단어를 업데이트할 수 있도록 감싸기
  const setWords = useCallback((updater: any) => {
    setWordbooks(prev => {
      return prev.map(book => {
        if (book.id !== activeBookId) return book;
        const nextWordsRaw = typeof updater === 'function' ? updater(book.words) : updater;
        return { ...book, words: normalizeWords(Array.isArray(nextWordsRaw) ? nextWordsRaw : []) };
      });
    });
  }, [activeBookId, normalizeWords]);

  useEffect(() => {
    // 1. 새 구조 로드
    const savedBooks = localStorage.getItem('voca_wordbooks_v2');
    const oldWords = localStorage.getItem('voca_words');

    if (savedBooks) {
      try {
        const parsed = JSON.parse(savedBooks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWordbooks(parsed);
          setActiveBookId(parsed[0].id);
        } else {
          throw new Error('Empty books');
        }
      } catch (e) {
        const defaultBook = { id: 'default', name: 'Main Library', words: INITIAL_WORDS, createdAt: Date.now() };
        setWordbooks([defaultBook]);
        setActiveBookId('default');
      }
    } else if (oldWords) {
      // 2. 마이그레이션 (v1 -> v2)
      try {
        const parsed = JSON.parse(oldWords);
        const migratedBook = { id: 'migrated', name: 'Migrated Library', words: normalizeWords(parsed), createdAt: Date.now() };
        setWordbooks([migratedBook]);
        setActiveBookId('migrated');
      } catch (e) {
        const defaultBook = { id: 'default', name: 'Main Library', words: INITIAL_WORDS, createdAt: Date.now() };
        setWordbooks([defaultBook]);
        setActiveBookId('default');
      }
    } else {
      // 3. 초기 상태
      const defaultBook = { id: 'default', name: 'Main Library', words: INITIAL_WORDS, createdAt: Date.now() };
      setWordbooks([defaultBook]);
      setActiveBookId('default');
    }
    setIsLoaded(true);
  }, [normalizeWords]);

  // 로컬스토리지 저장 (워커 이용)
  useEffect(() => {
    if (!isLoaded || !workerRef.current) return;
    workerRef.current.postMessage({ data: wordbooks });
  }, [wordbooks, isLoaded]);

  // 단어장 관리 함수들
  const addWordbook = (name: string) => {
    const newId = `book-${Date.now()}`;
    const newBook: Wordbook = {
      id: newId,
      name: name || `New Book ${wordbooks.length + 1}`,
      words: [],
      createdAt: Date.now()
    };
    setWordbooks(prev => [...prev, newBook]);
    setActiveBookId(newId);
  };

  const removeWordbook = (id: string) => {
    if (wordbooks.length <= 1) return alert('최소 한 개의 단어장은 유지해야 합니다.');
    if (!window.confirm('이 단어장의 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) return;
    
    setWordbooks(prev => {
      const filtered = prev.filter(b => b.id !== id);
      if (activeBookId === id) setActiveBookId(filtered[0].id);
      return filtered;
    });
  };

  const renameWordbook = (id: string, newName: string) => {
    setWordbooks(prev => prev.map(b => b.id === id ? { ...b, name: newName } : b));
  };

  const saveToSQL = async () => {
    if (!SQL_DATA_URL || !SQL_API_KEY) return alert('서버 설정이 누락되었습니다.');
    if (!syncId.trim()) return alert('Sync ID를 입력해주세요.');
    
    setIsSyncing(true);
    try {
      const idHash = await hashString(syncId.trim());
      const passHash = syncPassword.trim() ? await hashString(syncPassword.trim()) : null;

      const checkRes = await fetch(`${SQL_DATA_URL}?id=eq.${idHash}`, {
        headers: { 'apikey': SQL_API_KEY, 'Authorization': `Bearer ${SQL_API_KEY}` }
      });
      const existing = await checkRes.json();
      
      if (Array.isArray(existing) && existing.length > 0 && existing[0].password && existing[0].password !== passHash) {
        setIsSyncing(false);
        return alert('❌ 보안 오류: 비밀번호가 일치하지 않습니다.');
      }

      // 전체 단어장 목록을 저장하도록 수정
      const response = await fetch(`${SQL_DATA_URL}?on_conflict=id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SQL_API_KEY,
          'Authorization': `Bearer ${SQL_API_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ 
          id: idHash, 
          content: wordbooks, // wordbooks 전체 저장
          password: passHash,
          updated_at: new Date().toISOString() 
        }),
      });

      if (response.ok) alert(`✅ '${syncId}' 저장 완료.`);
      else alert('❌ 저장 실패');
    } catch (e) {
      alert('🌐 네트워크 오류');
    } finally {
      setIsSyncing(false);
    }
  };

  const loadFromSQL = async () => {
    if (!SQL_DATA_URL || !SQL_API_KEY) return alert('서버 설정이 누락되었습니다.');
    if (!syncId.trim()) return alert('Sync ID를 입력하세요.');
    
    setIsSyncing(true);
    try {
      const idHash = await hashString(syncId.trim());
      const response = await fetch(`${SQL_DATA_URL}?id=eq.${idHash}`, {
        headers: { 'apikey': SQL_API_KEY, 'Authorization': `Bearer ${SQL_API_KEY}` }
      });
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].content) {
        const loaded = data[0].content;
        if (Array.isArray(loaded)) {
          setWordbooks(loaded);
          if (loaded.length > 0) setActiveBookId(loaded[0].id);
        } else {
          // 예전 방식(단일 배열) 로드 대응
          const migrated = [{ id: 'sql-migrated', name: 'SQL Migrated', words: normalizeWords(loaded), createdAt: Date.now() }];
          setWordbooks(migrated);
          setActiveBookId('sql-migrated');
        }
        alert(`📂 '${syncId}' 데이터 로드 완료.`);
      } else alert('ℹ️ 해당 ID로 저장된 데이터가 없습니다.');
    } catch (e) {
      alert('❌ 로드 실패');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLinkFile = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          // 파일 내용이 Wordbook[] 인지 Word[] 인지 체크
          if (data.length > 0 && data[0].words) {
            setWordbooks(data);
            setActiveBookId(data[0].id);
          } else {
            // 단일 Word[] 라면 현재 단어장에 추가
            setWords(data);
          }
          alert('JSON 데이터를 불러왔습니다.');
        } else alert('올바른 형식이 아닙니다.');
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    input.click();
  };

  const exportToJSON = () => {
    if (wordbooks.length === 0) return alert('데이터가 없습니다.');
    const blob = new Blob([JSON.stringify(wordbooks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voca_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    words, setWords, wordbooks, activeBookId, setActiveBookId,
    addWordbook, removeWordbook, renameWordbook,
    syncId, setSyncId, syncPassword, setSyncPassword, isSyncing,
    saveToSQL, loadFromSQL, handleLinkFile, exportToJSON
  };
};
