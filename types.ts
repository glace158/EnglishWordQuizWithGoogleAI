
export enum QuizMode {
  KR_TO_EN = 'KR_TO_EN',
  EN_TO_KR = 'EN_TO_KR',
  EXAMPLE_GAP = 'EXAMPLE_GAP',
  WORD_MATCH = 'WORD_MATCH',
  AI_SENTENCE_GEN = 'AI_SENTENCE_GEN',
  AI_DICTATION = 'AI_DICTATION'
}

export enum SelectionMode {
  ORDERED = 'ORDERED',
  RANDOM = 'RANDOM'
}

// System voices are dynamic strings
export type VoiceName = string;

export interface Word {
  id: string;
  kr: string;
  en: string;
  example: string;
  exampleKr: string;
  correctCount: number;
  incorrectCount: number;
  isMastered: boolean;
  // SRS Fields
  interval: number;      // Days until next review
  easiness: number;      // SM-2 Easiness factor (default 2.5)
  repetitions: number;   // Number of consecutive correct answers
  nextReview: number;    // Timestamp (ms)
}

export interface QuizState {
  currentWord: Word | null;
  userInput: string;
  isSubmitted: boolean;
  isCorrect: boolean;
  showHint: boolean;
  message: string;
  isSpeaking: boolean;
  isListening: boolean;
  aiContextSentence?: string; // AI가 생성한 한국어 문장 (AI Translation 모드용)
  aiDictationSentence?: string; // AI가 생성한 영어 예문 (AI Dictation 모드용)
  aiFeedback?: string;        // AI의 평가 피드백
  isAiLoading?: boolean;      // AI 처리 중 로딩 상태
}
