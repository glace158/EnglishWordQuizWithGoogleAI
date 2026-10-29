/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple client-side oscillator-synthesized sound effects 
// No external assets required so it operates fully offline and instant-response!

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

export function playSuccessSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  
  // High pitch sparkling sound
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';

  osc1.frequency.setValueAtTime(523.25, now); // C5
  osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
  osc1.frequency.setValueAtTime(783.99, now + 0.2); // G5
  osc1.frequency.setValueAtTime(1046.50, now + 0.3); // C6

  osc2.frequency.setValueAtTime(261.63, now); // C4
  osc2.frequency.setValueAtTime(329.63, now + 0.15); // E4

  gainNode.gain.setValueAtTime(0.08, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc1.connect(gainNode);
  osc1.connect(ctx.destination);
  osc2.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + 0.5);
  osc2.start(now);
  osc2.stop(now + 0.5);
}

export function playIncorrectSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;

  // Gentle low-pitch buzzer sound
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.linearRampToValueAtTime(120, now + 0.35);

  gainNode.gain.setValueAtTime(0.08, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.4);
}
