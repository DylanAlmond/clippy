import { invoke } from '@tauri-apps/api/core';
import { Animator } from './handler/animator';
import { SpeechBubble } from './handler/speech';
import { updateWindowSize } from './util/window';
import { AnimationName } from './types';
import sprite from './util/sprite';

const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
const assistant = document.querySelector('#assistant') as HTMLElement;

const bubble = new SpeechBubble(document.querySelector('#speech-bubble')!);
const animator = new Animator(canvas, sprite);

const observer = new ResizeObserver(() => {
  updateWindowSize(assistant);
});
observer.observe(assistant);

async function playIntro() {
  await animator.queue('Greeting');
  await animator.queue('GetAttention');
  bubble.show('Hello! I am Clippy!');
}

// Helper function to handle LLM interaction
async function triggerClippyVision() {
  // 1. Play an animation and show "thinking" text
  // animator.play('GetAttention');
  // bubble.show('Let me take a look at your screen...');

  try {
    // 2. Dynamically get all valid animations from the sprite
    const validAnimations = Object.keys(sprite.animations);

    // 3. Call the Rust backend, passing the animations array
    const reaction = await invoke<{ text: string; animation: string }>(
      'get_clippy_reaction',
      { animations: validAnimations } // <-- Passed to Rust
    );

    // 4. Double-check the LLM chose a valid animation (fallback to Idle if it hallucinated)
    const isAnimationValid = validAnimations.includes(reaction.animation);

    if (isAnimationValid) {
      animator.play(reaction.animation as AnimationName<typeof sprite>);
    } else {
      animator.play('Idle1_1');
    }

    // 5. Show the text
    bubble.show(reaction.text);
  } catch (error) {
    console.error('Clippy Vision failed:', error);
    animator.play('Alert');
    bubble.show("I couldn't see your screen. Is LM Studio running?");
  }
}

// Trigger LLM vision on click
// canvas.addEventListener('click', () => {
//   triggerClippyVision();
// });

async function startVisionLoop() {
  while (true) {
    try {
      await triggerClippyVision();
    } catch (err) {
      console.error(err);
    }

    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
}

(async () => {
  await playIntro();

  animator.play('GetAttention');
  bubble.show('Let me take a look at your screen...');

  await startVisionLoop();
})();
