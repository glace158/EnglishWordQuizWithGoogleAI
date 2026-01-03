
import { GoogleGenAI } from "@google/genai";
import { VoiceName } from "../types";

/**
 * Browser-native Speech Synthesis Service.
 */

export const getSystemVoices = (): SpeechSynthesisVoice[] => {
  return window.speechSynthesis.getVoices().filter(voice => 
    voice.lang.includes('en') || voice.lang.includes('EN')
  );
};

export const speakText = async (text: string, voiceName?: VoiceName): Promise<void> => {
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.name === voiceName);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(event);
    window.speechSynthesis.speak(utterance);
  });
};

/**
 * Gemini API Quota Tracking
 */
const DAILY_QUOTA_LIMIT = 1500;

export const getApiUsage = () => {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem('voca_api_usage_v2');
  if (stored) {
    const { date, count } = JSON.parse(stored);
    if (date === today) return count;
  }
  return 0;
};

const incrementApiUsage = () => {
  const today = new Date().toISOString().split('T')[0];
  const current = getApiUsage();
  localStorage.setItem('voca_api_usage_v2', JSON.stringify({ date: today, count: current + 1 }));
};

export const getRemainingQuota = () => Math.max(0, DAILY_QUOTA_LIMIT - getApiUsage());

/**
 * Gemini API Services for AI Learning Features
 */
// 규정에 따라 process.env.API_KEY를 직접 사용합니다.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateAISentence = async (word: string, meaning: string): Promise<string> => {
  incrementApiUsage();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `영어 단어 '${word}'(뜻: ${meaning})를 사용하여 자연스러운 한국어 문장 하나를 만들어주세요. 문장 안에 영어 단어 자체는 포함하지 말고 한국어로만 구성하세요. 오직 한국어 문장만 출력하세요.`,
    });
    return response.text?.trim() || "문장을 생성할 수 없습니다.";
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return "AI 문장 생성에 실패했습니다.";
  }
};

export const generateAIDictationSentence = async (word: string): Promise<string> => {
  incrementApiUsage();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create one short, clear, and natural English example sentence using the word '${word}'. Output ONLY the English sentence itself.`,
    });
    return response.text?.trim() || "Could not generate sentence.";
  } catch (error) {
    console.error("Gemini Dictation Error:", error);
    return "AI English sentence generation failed.";
  }
};

export const evaluateTranslation = async (targetWord: string, targetMeaning: string, krContext: string, userEnInput: string): Promise<{isCorrect: boolean, feedback: string}> => {
  incrementApiUsage();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        학습 목표 단어: '${targetWord}' (뜻: ${targetMeaning})
        제시된 한국어 상황: "${krContext}"
        사용자의 영어 번역: "${userEnInput}"

        평가 기준:
        1. 사용자의 번역이 한국어 상황의 의미를 잘 전달하는가?
        2. 문법적인 오류가 없는가?
        3. 목표 단어 '${targetWord}'를 적절하게 사용했는가?

        만약 정답이라면(isCorrect: true), 반드시 "같은 의미를 가진 다른 세련된 영어 표현 예시"를 2개 이상 포함하여 풍부하게 피드백해주세요.
        
        응답은 반드시 아래 JSON 형식으로만 하세요:
        {
          "isCorrect": true 또는 false,
          "feedback": "평가 피드백 및 정답 시 추가 표현 예시 (한국어로 친절하게)"
        }
      `,
      config: { responseMimeType: "application/json" }
    });
    
    const result = JSON.parse(response.text?.trim() || '{"isCorrect":false, "feedback":"평가에 실패했습니다."}');
    return result;
  } catch (error) {
    console.error("Gemini Evaluation Error:", error);
    return { isCorrect: false, feedback: "AI 평가 서비스를 이용할 수 없습니다." };
  }
};

export const evaluateDictation = async (original: string, userTyped: string): Promise<{isCorrect: boolean, feedback: string}> => {
  incrementApiUsage();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Original English Sentence: "${original}"
        User's Typed Input: "${userTyped}"

        Evaluate if the user's input matches the original sentence. 
        Allow for minor punctuation or capitalization differences, but the words must be correct.
        If correct, provide a positive reinforcement in Korean.
        If incorrect, show where they made a mistake in Korean.
        
        응답은 반드시 아래 JSON 형식으로만 하세요:
        {
          "isCorrect": true 또는 false,
          "feedback": "피드백 내용 (한국어로 친절하게)"
        }
      `,
      config: { responseMimeType: "application/json" }
    });
    
    const result = JSON.parse(response.text?.trim() || '{"isCorrect":false, "feedback":"평가에 실패했습니다."}');
    return result;
  } catch (error) {
    console.error("Gemini Dictation Evaluation Error:", error);
    return { isCorrect: false, feedback: "AI 평가에 실패했습니다." };
  }
};
