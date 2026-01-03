
import { useEffect } from 'react';
import { QuizMode } from '../types';

export const useKeyboardShortcuts = (activeTab: string, isAuthorized: boolean, quiz: any) => {
  useEffect(() => {
    if (!isAuthorized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'quiz') return;
      
      if (e.key === 'Enter') { 
        if (quiz.state.isSubmitted) quiz.getNextWord();
        else if (quiz.quizMode !== QuizMode.WORD_MATCH) quiz.handleSubmit();
      }
      else if (e.key === 'Backspace' && quiz.state.isSubmitted) {
        quiz.setState((prev: any) => ({ ...prev, userInput: '', isSubmitted: false, isCorrect: false }));
      }
      else if (e.key === 'Control') {
        const allowedModesForHint = [
          QuizMode.EXAMPLE_GAP, 
          QuizMode.AI_SENTENCE_GEN, 
          QuizMode.AI_DICTATION
        ];
        if (allowedModesForHint.includes(quiz.quizMode)) {
          quiz.setState((prev: any) => ({ ...prev, showHint: !prev.showHint }));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, quiz, isAuthorized]);
};
