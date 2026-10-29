/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WordItem {
  id: string;
  word: string;                  // e.g. "able"
  meaning: string;               // e.g. "~할 수 있는"
  sentence: string;              // e.g. "With practice, you will be able to play the piano."
  sentence_translation: string;  // e.g. "연습하면, 당신은 피아노를 칠 수 있게 될 것입니다."
  attempts: number;              // number of times this word was tested
  correctCount: number;          // number of correct answers
  mastered: boolean;             // whether the user marked/learned it as mastered
}

export type QuizMode = 'KR_EN' | 'EN_KR' | 'SENT_BLANK' | 'HEAR';

export type OrderMode = 'ORDERED' | 'WEIGHTED' | 'SHUFFLED' | 'WEAK_ONLY';

export interface TrainingStats {
  wordsTotal: number;
  mastered: number;
  learning: number;
  avgAccuracy: number;
}

export interface WordList {
  id: string;
  name: string;
  words: WordItem[];
}

export function isWeakWord(word: WordItem, threshold: number): boolean {
  if (word.attempts === 0) return false;
  if (word.attempts <= word.correctCount) return false;
  const accuracy = Math.round((word.correctCount / word.attempts) * 100);
  return accuracy <= threshold;
}
