
import { useState, useCallback } from 'react';
import { hashString } from '../utils/crypto';

// 환경 변수 로드 유틸리티
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

const SQL_AUTH_URL = PROJECT_URL ? `${PROJECT_URL}/rest/v1/voca_user_registered` : "";
const SQL_DATA_URL = PROJECT_URL ? `${PROJECT_URL}/rest/v1/word_data` : "";

export const useAuth = (setWords: (words: any) => void) => {
  const [isAuthorized, setIsAuthorized] = useState(() => sessionStorage.getItem('voca_auth_session') === 'active');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showError, setShowError] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginAction = useCallback(async () => {
    if (!PROJECT_URL || !SQL_API_KEY || !SQL_AUTH_URL) {
      console.error("Supabase Config Missing:", { PROJECT_URL, SQL_API_KEY });
      setStatusMessage('서버 설정이 누락되었습니다. VITE_SUPABASE_URL를 확인하세요.');
      return;
    }

    if (!loginId.trim() || !password.trim()) {
      setStatusMessage('ID와 Password를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('서버 인증 시도 중...');

    try {
      // 이제 어떤 환경에서도 표준 SHA-256 해시가 생성됩니다.
      const idHash = await hashString(loginId.trim());
      const passHash = await hashString(password.trim());

      console.group("🔑 VocaMaster Auth Debug (Standard SHA-256)");
      console.log("Original ID:", loginId.trim());
      console.log("Standard Hash ID (Use this in DB):", idHash);
      console.log("Standard Hash Password (Use this in DB):", passHash);
      console.groupEnd();

      const authRes = await fetch(`${SQL_AUTH_URL}?id=eq.${idHash}`, {
        headers: { 
          'apikey': SQL_API_KEY, 
          'Authorization': `Bearer ${SQL_API_KEY}` 
        }
      });
      
      if (!authRes.ok) {
        const errorDetail = await authRes.text();
        throw new Error(`HTTP ${authRes.status}: ${errorDetail}`);
      }

      const authData = await authRes.json();

      if (Array.isArray(authData) && authData.length > 0) {
        if (authData[0].password === passHash) {
          setStatusMessage('인증 성공! 데이터 로딩 중...');
          
          const dataRes = await fetch(`${SQL_DATA_URL}?id=eq.${idHash}`, {
            headers: { 
              'apikey': SQL_API_KEY, 
              'Authorization': `Bearer ${SQL_API_KEY}` 
            }
          });
          
          if (dataRes.ok) {
            const contentData = await dataRes.json();
            if (contentData.length > 0 && contentData[0].content) {
              setWords(contentData[0].content);
            }
          }

          setIsAuthorized(true);
          sessionStorage.setItem('voca_auth_session', 'active');
          localStorage.setItem('voca_user_registered', 'true');
        } else {
          setStatusMessage('비밀번호가 일치하지 않습니다.');
          setShowError(true);
          setTimeout(() => setShowError(false), 500);
        }
      } else {
        setStatusMessage('등록되지 않은 ID입니다. (Hashed ID가 DB와 일치하는지 확인하세요)');
        setShowError(true);
        setTimeout(() => setShowError(false), 500);
      }
    } catch (err: any) {
      console.error("Auth Exception:", err);
      setStatusMessage(`오류: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [loginId, password, setWords]);

  return {
    isAuthorized, loginId, setLoginId, password, setPassword,
    showError, statusMessage, isLoading, handleLoginAction
  };
};
