import { ClippyAgent } from './handler/agent';
import { updateWindowSize } from './util/window';
import { DEBUG } from './util/constants';

if (DEBUG) {
  document.body.style.backgroundColor = 'blue';
}

const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
const assistant = document.querySelector('#assistant') as HTMLElement;

// Initialize handlers
const bubble = document.querySelector('#speech-bubble') as HTMLDivElement;

// Handle window resizing
const observer = new ResizeObserver(() => {
  updateWindowSize(assistant);
});
observer.observe(assistant);

// Initialize and start the Clippy Agent
const agent = new ClippyAgent(canvas, bubble);
agent.start();

canvas.addEventListener('click', () => {
  agent.talk('Hey! Stop poking me!', 'GetAttention');
});
