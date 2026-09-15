import { AUDIO_FILES } from "../data/assets";

type Sound = keyof typeof AUDIO_FILES;

export class SoundPlayer {
  private context: AudioContext | null = null;
  private enabled = true;
  private playing: HTMLAudioElement | null = null;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  play(sound: Sound): void {
    if (!this.enabled) return;
    const file = AUDIO_FILES[sound];
    if (file) {
      this.playing?.pause();
      this.playing = new Audio(file);
      void this.playing.play().catch(() => {});
      return;
    }
    try {
      this.context ??= new AudioContext();
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const now = this.context.currentTime;
      const notes: Record<Sound, [number, number, OscillatorType]> = {
        entry: [660, 0.09, "sine"], stop: [330, 0.09, "triangle"],
        reach: [740, 0.34, "triangle"], max: [220, 0.11, "square"],
        jackpot: [880, 0.6, "triangle"],
        crack: [140, 0.22, "sawtooth"], mirror: [520, 0.5, "triangle"],
        push: [440, 0.12, "square"]
      };
      const [frequency, duration, type] = notes[sound];
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (sound === "jackpot" || sound === "mirror") oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.7, now + duration);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch {
      // Audio is optional; autoplay restrictions must never stop a spin.
    }
  }

  stop(): void {
    this.playing?.pause();
    this.playing = null;
  }
}
