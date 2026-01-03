
export enum QuizMode {
  KR_TO_EN = 'KR_TO_EN',
  EN_TO_KR = 'EN_TO_KR',
  EXAMPLE_GAP = 'EXAMPLE_GAP',
  WORD_MATCH = 'WORD_MATCH'
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
}

export interface QuizState {
  currentWord: Word | null;
  userInput: string;
  isSubmitted: boolean;
  isCorrect: boolean;
  showHint: boolean;
  message: string;
  isSpeaking: boolean;
}
