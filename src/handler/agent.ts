import { invoke } from '@tauri-apps/api/core';
import { Animator } from './animator';
import { SpeechBubble } from './speech';
import { AnimationName } from '../types';
import { DEBUG } from '../util/constants';
import sprite from '../util/sprite';

export enum AgentState {
  INTRO = 'INTRO',
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  REACTING = 'REACTING',
  ERROR = 'ERROR'
}

export class ClippyAgent {
  private sprite = sprite;
  private animator: Animator<typeof this.sprite>;
  private bubble: SpeechBubble;

  private state: AgentState = AgentState.IDLE;
  private isRunning = false;

  private idleAnims: AnimationName<typeof this.sprite>[] = [
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

  private searchingAnims: AnimationName<typeof this.sprite>[] = [
    'CheckingSomething',
    'Searching',
    'Processing'
  ];

  private validAnimations = Object.keys(this.sprite.animations);

  private minimumVisionIntervalMs = 15000; // Time spent idle before next vision check

  constructor(canvas: HTMLCanvasElement, bubble: HTMLDivElement) {
    this.animator = new Animator(canvas, this.sprite);
    this.bubble = new SpeechBubble(bubble);
  }

  /**
   * Starts the agent's lifecycle.
   */
  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    await this.runIntro();
    if (this.isRunning) this.beginIdleCycle();
  }

  /**
   * Stops the agent completely.
   */
  public stop() {
    this.isRunning = false;
    this.animator.stop();
    this.bubble.hide();
  }

  /**
   * Display Message
   */
  public talk(message: string, animation?: AnimationName<typeof this.sprite>) {
    this.bubble.show(message);
    animation && this.animator.play(animation);
  }

  // -------------------------
  // State Machine Logic
  // -------------------------

  private async runIntro() {
    this.setState(AgentState.INTRO);

    await this.animator.queue('Greeting' as AnimationName<typeof this.sprite>);

    if (!this.isRunning) return;

    await Promise.all([
      this.bubble.queue('Hello! I am Clippy!', 4000),
      this.animator.play('Wave' as AnimationName<typeof this.sprite>)
    ]);
  }

  private async beginIdleCycle() {
    if (!this.isRunning) return;
    this.setState(AgentState.IDLE);

    // Start playing random idle animations in the background
    this.runIdleLoop();

    // Wait for the specified interval
    await new Promise((resolve) =>
      setTimeout(resolve, this.minimumVisionIntervalMs + Math.random() * 10000)
    );

    // If still running, trigger a vision cycle
    if (this.isRunning) {
      await this.triggerVisionCycle();

      // Go back to idle
      if (this.isRunning) this.beginIdleCycle();
    }
  }

  private async runIdleLoop() {
    while (this.isRunning && this.state === AgentState.IDLE) {
      await new Promise((resolve) => setTimeout(resolve, 4000 + Math.random() * 4000));

      // Re-check after waking up
      if (!this.isRunning || this.state !== AgentState.IDLE) {
        break;
      }

      const randomIdle = this.idleAnims[Math.floor(Math.random() * this.idleAnims.length)];

      console.log('start anim');

      const success = await this.animator.play(randomIdle);
      console.log('success', success);

      if (!success) break;
    }
  }

  private async triggerVisionCycle() {
    if (!this.isRunning) return;
    this.setState(AgentState.SEARCHING);

    // Play searching animation and text
    const searchAnim = this.searchingAnims[Math.floor(Math.random() * this.searchingAnims.length)];
    this.animator.play(searchAnim); // This automatically interrupts the idle loop
    this.bubble.show('Let me take a look at your screen...');

    try {
      // Call the Rust backend
      const reaction = await invoke<{ text: string; animation: string }>('get_clippy_reaction', {
        animations: this.validAnimations
      });

      if (!this.isRunning) return;

      this.setState(AgentState.REACTING);

      const isAnimationValid = this.validAnimations.includes(reaction.animation);
      const animName = (isAnimationValid ? reaction.animation : 'Idle1_1') as AnimationName<
        typeof this.sprite
      >;

      // Calculate read duration based on text length
      const bubbleDuration = Math.max(4000, reaction.text.length * 60);

      // Wait for both the animation and the bubble to finish
      await Promise.all([
        this.animator.play(animName),
        this.bubble.queue(reaction.text, bubbleDuration)
      ]);
    } catch (error) {
      console.error('Clippy Vision failed:', error);
      if (!this.isRunning) return;

      this.setState(AgentState.ERROR);

      await Promise.all([
        this.animator.play('Alert' as AnimationName<typeof this.sprite>),
        this.bubble.queue("I couldn't see your screen. Is LM Studio running?", 4000)
      ]);
    }

    console.log('hello');

    // Stop any looped animations after response has been shown
    this.animator.exitAnimation();
  }

  private setState(newState: AgentState) {
    if (DEBUG) console.log(`[ClippyAgent] State: ${this.state} -> ${newState}`);
    this.state = newState;
  }
}
