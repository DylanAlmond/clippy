import { invoke } from '@tauri-apps/api/core';
import { Animator } from './animator';
import { SpeechBubble } from './speech';
import { AnimationName, Sprite } from '../types';
import { DEBUG } from '../util/constants';

export enum AgentState {
  INTRO = 'INTRO',
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  REACTING = 'REACTING',
  ERROR = 'ERROR'
}

export type AgentConfig<TSprite extends Sprite> = {
  idleAnims?: AnimationName<TSprite>[];
  searchingAnims?: AnimationName<TSprite>[];
};

export class ClippyAgent<TSprite extends Sprite> {
  private animator: Animator<TSprite>;
  private bubble: SpeechBubble;

  private state: AgentState = AgentState.IDLE;
  private isRunning = false;

  private idleAnims: AnimationName<TSprite>[];
  private searchingAnims: AnimationName<TSprite>[];
  private validAnimations: string[];

  private minimumVisionIntervalMs = 15000; // Time spent idle before next vision check

  constructor(
    animator: Animator<TSprite>,
    bubble: SpeechBubble,
    sprite: TSprite,
    config?: AgentConfig<TSprite>
  ) {
    this.animator = animator;
    this.bubble = bubble;
    this.validAnimations = Object.keys(sprite.animations);

    this.idleAnims = config?.idleAnims || [];
    this.searchingAnims = config?.searchingAnims || [];
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

  // -------------------------
  // State Machine Logic
  // -------------------------

  private async runIntro() {
    this.setState(AgentState.INTRO);

    await this.animator.queue('Greeting' as AnimationName<TSprite>);

    if (!this.isRunning) return;

    await Promise.all([
      this.bubble.queue('Hello! I am Clippy!', 4000),
      this.animator.play('Wave' as AnimationName<TSprite>)
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
      const animName = (
        isAnimationValid ? reaction.animation : 'Idle1_1'
      ) as AnimationName<TSprite>;

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
        this.animator.play('Alert' as AnimationName<TSprite>),
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
