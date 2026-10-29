/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Get all available English speech synthesis voices from the browser.
 */
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  // Filter for English voices (e.g., en-US, en-GB, en-AU, etc.)
  return voices.filter(voice => voice.lang.toLowerCase().startsWith('en'));
}

/**
 * Speak a given text using Web Speech API with the preferred voice.
 */
export function speakText(text: string, voiceName?: string, rate: number = 0.95): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis is not supported on this browser.');
    return;
  }

  // Cancel any ongoing speaking
  try {
    window.speechSynthesis.cancel();
  } catch (e) {
    console.error('Error cancelling speech synthesis:', e);
  }

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Set the voice if one was requested and matches
  if (voiceName) {
    const allVoices = window.speechSynthesis.getVoices();
    const selectedVoice = allVoices.find(voice => voice.name === voiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = 'en-US'; // fallback
    }
  } else {
    utterance.lang = 'en-US'; // default
  }

  utterance.rate = rate; // slightly slower for better learning clarity
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
}
