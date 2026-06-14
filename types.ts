
export enum QuizMode {
  KR_TO_EN = 'KR_TO_EN',
  EN_TO_KR = 'EN_TO_KR',
  EXAMPLE_GAP = 'EXAMPLE_GAP',
  WORD_MATCH = 'WORD_MATCH',
  AI_SENTENCE_GEN = 'AI_SENTENCE_GEN',
  AI_DICTATION = 'AI_DICTATION',
  DET_SPEAKING = 'DET_SPEAKING',
  DET_WRITING = 'DET_WRITING'
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

export interface Wordbook {
  id: string;
  name: string;
  words: Word[];
  createdAt: number;
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
  detTask?: {
    task: string;
    prepTime: string;
    responseTime: string;
    structure: string;
    modelAnswer: string;
    userAction: string;
    selfCheck: string[];
  }; // DET 모드용 데이터
  detFeedback?: {
    scoreEstimate: string;
    overallFeedback: string;
    correctedAnswer: string;
    selfCheckResults: Array<{
      title: string;
      status: boolean;
      detail: string;
    }>;
  }; // DET 전용 구조화 피드백
  aiFeedback?: string;        // AI의 평가 피드백
  isAiLoading?: boolean;      // AI 처리 중 로딩 상태
  showModelAnswer?: boolean;  // DET 모델 답안 노출 여부
  timerSeconds?: number;      // DET 타이머
  isTimerActive?: boolean;    // 타이머 활성화 여부
}
