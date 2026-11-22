// Procedural Web Audio API soundscape: coin clink, smoke hiss, EMP pulse, loot chime, alert & victory chords.

export function createHeistAudio() {
  let ctx = null;
  let muted = false;

  function ensureContext() {
    if (muted || typeof window === 'undefined') return null;
    if (!ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      ctx = new AudioCtor();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playTone(freqStart, freqEnd, duration, type = 'sine', gainPeak = 0.08) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playNoise(duration, gainPeak = 0.06) {
    const c = ensureContext();
    if (!c) return;
    const length = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    const gain = c.createGain();
    gain.gain.value = gainPeak;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
  }

  return {
    unlock: ensureContext,
    isMuted: () => muted,
    toggleMute: () => {
      muted = !muted;
      return muted;
    },
    emit(eventName) {
      if (muted) return;
      if (eventName === 'coin') {
        playTone(1480, 1960, 0.14, 'triangle', 0.09);
      } else if (eventName === 'smoke') {
        playNoise(0.45, 0.08);
      } else if (eventName === 'emp') {
        playTone(760, 130, 0.28, 'sawtooth', 0.09);
      } else if (eventName === 'hack' || eventName === 'vent') {
        playTone(440, 880, 0.16, 'sine', 0.06);
      } else if (eventName === 'loot') {
        playTone(587, 880, 0.22, 'triangle', 0.1);
        setTimeout(() => playTone(880, 1175, 0.26, 'triangle', 0.09), 90);
      } else if (eventName === 'caught') {
        playTone(220, 72, 0.45, 'sawtooth', 0.12);
      } else if (eventName === 'extracted') {
        playTone(523, 659, 0.22, 'triangle', 0.1);
        setTimeout(() => playTone(659, 784, 0.22, 'triangle', 0.1), 110);
        setTimeout(() => playTone(784, 1046, 0.35, 'triangle', 0.11), 220);
      }
    },
  };
}
