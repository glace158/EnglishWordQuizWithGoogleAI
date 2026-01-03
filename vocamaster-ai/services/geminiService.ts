
import { VoiceName } from "../types";

/**
 * Browser-native Speech Synthesis Service.
 * No API calls, no quota limits.
 */

// Prefetch is not needed for native TTS as it's nearly instant
export const prefetchVoice = (text: string, voiceName: VoiceName): void => {
  // Logic removed for native TTS
};

/**
 * Get available English voices from the system
 */
export const getSystemVoices = (): SpeechSynthesisVoice[] => {
  return window.speechSynthesis.getVoices().filter(voice => 
    voice.lang.includes('en') || voice.lang.includes('EN')
  );
};

/**
 * Plays the text audio using native speech synthesis.
 */
export const speakText = async (text: string, voiceName?: VoiceName): Promise<void> => {
  return new Promise((resolve, reject) => {
    // 1. Cancel any ongoing speech to prevent queue overlapping or "silent" bugs
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // 2. Select specific voice if provided
    if (voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.name === voiceName);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    // 3. Set properties for clarity
    utterance.lang = 'en-US';
    utterance.rate = 0.9; // Slightly slower for better learning
    utterance.pitch = 1.0;

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (event) => {
      console.error("Speech Synthesis Error:", event);
      reject(event);
    };

    // 4. Start speaking
    window.speechSynthesis.speak(utterance);

    // Chrome bug workaround: speech sometimes pauses after 15 seconds
    // but for short vocabularies this is usually not an issue.
  });
};
