/**
 * Web Audio API Notification Sound Synthesizer
 * Zero-dependency, low-latency, crisp chime for incoming chat messages
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/**
 * Plays a pleasant, modern, multi-tone chat notification chime
 */
export function playChatNotificationSound(volume = 0.35): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Master gain node
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(ctx.destination);

    // Chime chords / notes: D5 (587.33Hz) -> A5 (880.00Hz) -> D6 (1174.66Hz)
    const notes = [
      { freq: 587.33, start: 0, duration: 0.22, gain: 0.6 },
      { freq: 880.00, start: 0.07, duration: 0.28, gain: 0.8 },
      { freq: 1174.66, start: 0.14, duration: 0.45, gain: 0.95 }
    ];

    notes.forEach(({ freq, start, duration, gain: notePeakGain }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      // Sine wave with soft harmonic
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      // Smooth attack & exponential decay envelope
      const startTime = now + start;
      const attackTime = 0.015;
      const endTime = startTime + duration;

      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(notePeakGain, startTime + attackTime);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(startTime);
      osc.stop(endTime + 0.05);
    });
  } catch (error) {
    console.warn('Unable to play chat notification sound:', error);
  }
}
