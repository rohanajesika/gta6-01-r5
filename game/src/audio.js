// Every sound is synthesised with WebAudio inside this file: no audio files,
// no network. The context is created on the first user gesture (browsers block
// sound before one), and every method is a no-op until then.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Call from any user gesture so later sounds are allowed to play. */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
      gain.gain.setValueAtTime(vol, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  function noise(dur, vol, lowFreq) {
    if (!ensure()) return;
    try {
      const len = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFreq;
      const gain = context.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  return {
    unlock,
    click() { tone(660, 0.07, 'square', 0.12); },
    punch() { noise(0.12, 0.5, 900); tone(120, 0.12, 'sine', 0.4, 60); },
    pickup() { tone(880, 0.09, 'sine', 0.25); setTimeout(() => tone(1318, 0.14, 'sine', 0.25), 90); },
    cash() { tone(988, 0.08, 'triangle', 0.22); setTimeout(() => tone(1479, 0.16, 'triangle', 0.22), 80); },
    missionComplete() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.28), i * 130));
    },
    busted() { tone(220, 0.5, 'sawtooth', 0.2, 110); },
    wasted() { tone(330, 0.7, 'sawtooth', 0.2, 82); },
    engineStart() { tone(90, 0.3, 'sawtooth', 0.18, 180); },
    /** Continuous engine hum; call every frame with speed 0..1, or null to stop. */
    engine(speed01) {
      if (!ensure()) return;
      try {
        if (speed01 === null) {
          if (engineOsc) { engineOsc.stop(); engineOsc = null; engineGain = null; }
          return;
        }
        if (!engineOsc) {
          engineOsc = context.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = context.createGain();
          engineGain.gain.value = 0.05;
          const filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 700;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.setValueAtTime(55 + speed01 * 130, context.currentTime);
        engineGain.gain.setValueAtTime(0.03 + speed01 * 0.06, context.currentTime);
      } catch {
        // Sound is garnish: a failure here must never break the game.
      }
    },
    /** Two-tone police siren; call with true to start, false to stop. */
    siren(on) {
      if (!ensure()) return;
      try {
        if (!on) {
          if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
          if (sirenOsc) { sirenOsc.stop(); sirenOsc = null; sirenGain = null; }
          return;
        }
        if (sirenOsc) return;
        sirenOsc = context.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = context.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = false;
        sirenTimer = setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setValueAtTime(high ? 950 : 700, context.currentTime);
        }, 420);
      } catch {
        // Sound is garnish: a failure here must never break the game.
      }
    },
  };
}
