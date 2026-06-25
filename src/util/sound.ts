import soundsMp3 from './sounds-mp3';

/**
 * Play a mp3 sound by index (from base64 data URL)
 */
export function playSound(soundIndex: keyof typeof soundsMp3) {
  const src = soundsMp3[soundIndex];

  if (!src) {
    console.warn(`Sound ${soundIndex} not found`);
    return;
  }

  const audio = new Audio(src);
  audio.play().catch((err) => {
    console.error('Audio play failed:', err);
  });
}
