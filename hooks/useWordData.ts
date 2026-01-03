
import { useState, useEffect, useCallback, useRef } from 'react';
import { Word } from '../types';
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
    const { words } = e.data;
    try {
      const json = JSON.stringify(words);
      self.postMessage({ json });
    } catch (err) {
      self.postMessage({ error: err.message });
    }
  };
`;

export const useWordData = () => {
  const [words, setWordsInternal] = useState<Word[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncId, setSyncId] = useState<string>('');
  const [syncPassword, setSyncPassword] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e) => {
      if (e.data.json) localStorage.setItem('voca_words', e.data.json);
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

  const setWords = useCallback((updater: any) => {
    setWordsInternal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return normalizeWords(Array.isArray(next) ? next : []);
    });
  }, [normalizeWords]);

  useEffect(() => {
    const saved = localStorage.getItem('voca_words');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setWordsInternal(normalizeWords(Array.isArray(parsed) ? parsed : INITIAL_WORDS));
      } catch (e) {
        setWordsInternal(normalizeWords(INITIAL_WORDS));
      }
    } else {
      setWordsInternal(normalizeWords(INITIAL_WORDS));
    }
    setIsLoaded(true);
  }, [normalizeWords]);

  useEffect(() => {
    if (!isLoaded || !workerRef.current) return;
    workerRef.current.postMessage({ words });
  }, [words, isLoaded]);

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
          content: words, 
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
        setWords(data[0].content);
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
          setWords(data);
          alert('JSON 데이터를 불러왔습니다.');
        } else alert('올바른 형식이 아닙니다.');
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    input.click();
  };

  const exportToJSON = () => {
    if (words.length === 0) return alert('데이터가 없습니다.');
    const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voca_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    words, setWords, syncId, setSyncId, syncPassword, setSyncPassword, isSyncing,
    saveToSQL, loadFromSQL, handleLinkFile, exportToJSON
  };
};
