import { Animator } from './handler/animator';
import { SpeechBubble } from './handler/speech';
import { updateWindowSize } from './util/window';
import { AnimationName } from './types';
import sprite from './util/sprite';

const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
const assistant = document.querySelector('#assistant') as HTMLElement;

// Speech bubble handler
const bubble = new SpeechBubble(document.querySelector('#speech-bubble')!);

// Sprite animation + sound handling
const animator = new Animator(canvas, sprite);

// Adjust screensize to assistant + speech bubbles
const observer = new ResizeObserver(() => {
  updateWindowSize(assistant);
});

observer.observe(assistant);

async function playIntro() {
  await animator.queue('Greeting');
  console.log('Wave finished!');

  await animator.queue('GetAttention');
  console.log('Idle finished!');

  bubble.show('Hello! I am Clippy!');
}

// play random animation once
canvas.addEventListener('click', () => {
  const keys = Object.keys(sprite.animations) as AnimationName<typeof sprite>[];
  const random = keys[Math.floor(Math.random() * keys.length)];

  animator.play(random);

  bubble.show(`Playing: ${random}`);
});

playIntro();
