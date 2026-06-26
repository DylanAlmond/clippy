import { Animator } from './handler/animator';
import { SpeechBubble } from './handler/speech';
import { ClippyAgent } from './handler/agent';
import { updateWindowSize } from './util/window';
import { DEBUG } from './util/constants';
import sprite from './util/sprite';
import { AnimationName } from './types';

if (DEBUG) {
  document.body.style.backgroundColor = 'blue';
}

const idleAnims: AnimationName<typeof sprite>[] = [
  'Idle1_1',
  'IdleAtom',
  'IdleEyeBrowRaise',
  'IdleFingerTap',
  'IdleHeadScratch',
  'IdleRopePile',
  'IdleSideToSide',
  'IdleSnooze',
  'GetArtsy',
  'LookDown',
  'LookDownLeft',
  'LookDownRight',
  'LookLeft',
  'LookRight',
  'LookUp',
  'LookUpLeft',
  'LookUpRight',
  'RestPose',
  'GetWizardy',
  'GetAttention',
  'Save',
  'Writing'
];

const searchingAnims: AnimationName<typeof sprite>[] = [
  'CheckingSomething',
  'Searching',
  'Processing'
];

const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
const assistant = document.querySelector('#assistant') as HTMLElement;

// Initialize handlers
const bubble = new SpeechBubble(document.querySelector('#speech-bubble')!);
const animator = new Animator(canvas, sprite);

// Handle window resizing
const observer = new ResizeObserver(() => {
  updateWindowSize(assistant);
});
observer.observe(assistant);

// Initialize and start the Clippy Agent
const agent = new ClippyAgent(animator, bubble, sprite, {
  idleAnims: idleAnims,
  searchingAnims: searchingAnims
});
agent.start();

canvas.addEventListener('click', () => {
  bubble.show('Hey! Stop poking me!');
  animator.play('GetAttention');
});
