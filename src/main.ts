import { invoke } from '@tauri-apps/api/core';
import { Animator } from './handler/animator';
import { SpeechBubble } from './handler/speech';
import { updateWindowSize } from './util/window';
import { AnimationName } from './types';
import sprite from './util/sprite';

const DEBUG = false;

const searchingAnims: AnimationName<typeof sprite>[] = [
  'CheckingSomething',
  'Searching',
  'Processing'
];

if (DEBUG) {
  document.body.style.backgroundColor = 'blue';
}

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

  await Promise.all([bubble.queue('Hello! I am Clippy!', 4000), animator.queue('Wave')]);
}

// Helper function to handle LLM interaction
async function triggerClippyVision() {
  try {
    let hasResponse = false;

    // Enter looping search animation
    animator.play(searchingAnims[Math.floor(Math.random() * searchingAnims.length)]);

    // Force exit loop after a few seconds if not already received response
    setTimeout(() => {
      !hasResponse && animator.exitAnimation();
    }, 6000);

    // 2. Dynamically get all valid animations from the sprite
    const validAnimations = Object.keys(sprite.animations);

    // 3. Call the Rust backend, passing the animations array
    const reaction = await invoke<{ text: string; animation: string }>(
      'get_clippy_reaction',
      { animations: validAnimations } // <-- Passed to Rust
    );

    hasResponse = true;

    // 4. Double-check the LLM chose a valid animation (fallback to Idle if it hallucinated)
    const isAnimationValid = validAnimations.includes(reaction.animation);

    if (isAnimationValid) {
      animator.queue(reaction.animation as AnimationName<typeof sprite>);
      bubble.queue(reaction.text, 6000);
    } else {
      animator.queue('Idle1_1');
    }

    // 5. Show the text
    bubble.show(reaction.text);
  } catch (error) {
    console.error('Clippy Vision failed:', error);
    animator.queue('Alert');
    bubble.queue("I couldn't see your screen. Is LM Studio running?");
  }
}

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

  animator.queue('GetAttention');
  bubble.queue('Let me take a look at your screen...');

  await startVisionLoop();
})();
