import { Sprite, Frame, AnimationName } from '../types';
import map from '../assets/map.png';
import { playSound } from '../util/sound';

export enum AnimatorState {
  WAITING = 1,
  EXITED = 0
}

/**
 * Sprite animator class. Handles playing animations, branching, sounds, and sequential queueing.
 */
export class Animator<TSprite extends Sprite> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private sprite: TSprite;
  private img: HTMLImageElement;

  private currentAnimation: any = null;
  private animationName: AnimationName<TSprite> | null = null;

  private frameIndex = 0;
  private currentFrame: Frame | null = null;

  private exiting = false;
  private timeout: number | null = null;

  // Queue System Properties
  private animationQueue: Array<{
    name: AnimationName<TSprite>;
    onStateChange?: (name: AnimationName<TSprite>, state: AnimatorState) => void;
    resolve: (success: boolean) => void;
  }> = [];
  private currentResolve: ((success: boolean) => void) | null = null;

  private onStateChange?: (name: AnimationName<TSprite>, state: AnimatorState) => void;

  constructor(canvas: HTMLCanvasElement, sprite: TSprite) {
    this.canvas = canvas;
    this.sprite = sprite;

    canvas.width = sprite.frameSize[0];
    canvas.height = sprite.frameSize[1];

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Missing 2D context');
    this.ctx = ctx;

    this.img = new Image();
    this.img.src = map;
  }

  // -------------------------
  // Public API
  // -------------------------

  /**
   * Plays an animation immediately, interrupting and clearing the current queue.
   */
  play(
    name: AnimationName<TSprite>,
    onStateChange?: (name: AnimationName<TSprite>, state: AnimatorState) => void
  ): boolean {
    this.clearQueue();
    return this.startAnimation(name, onStateChange, undefined);
  }

  /**
   * Queues an animation to play after the current one finishes.
   * Returns a Promise that resolves to `true` when completed, or `false` if interrupted.
   */
  queue(
    name: AnimationName<TSprite>,
    onStateChange?: (name: AnimationName<TSprite>, state: AnimatorState) => void
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.currentAnimation) {
        // If nothing is playing, start immediately
        this.startAnimation(name, onStateChange, resolve);
      } else {
        // Add to queue
        this.animationQueue.push({ name, onStateChange, resolve });

        // If the current animation is stuck waiting on exit branching, force it to exit
        this.exitAnimation();
      }
    });
  }

  exitAnimation(): void {
    this.exiting = true;
  }

  pause(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  resume(): void {
    this.step();
  }

  stop(): void {
    this.stopInternal();
    this.clearQueue();
  }

  // -------------------------
  // Queue & Core Logic
  // -------------------------

  private clearQueue() {
    // Resolve any pending queue promises as interrupted (false)
    while (this.animationQueue.length > 0) {
      const item = this.animationQueue.shift();
      item?.resolve(false);
    }

    if (this.currentResolve) {
      this.currentResolve(false);
      this.currentResolve = null;
    }
  }

  private processQueue() {
    if (this.animationQueue.length === 0) {
      this.currentAnimation = null;
      this.animationName = null;
      return;
    }

    const { name, onStateChange, resolve } = this.animationQueue.shift()!;
    this.startAnimation(name, onStateChange, resolve);
  }

  private startAnimation(
    name: AnimationName<TSprite>,
    onStateChange: ((name: AnimationName<TSprite>, state: AnimatorState) => void) | undefined,
    resolve: ((success: boolean) => void) | undefined
  ): boolean {
    const anim = this.sprite.animations[name];
    if (!anim) {
      resolve?.(false);
      this.processQueue();
      return false;
    }

    // If we are starting a new animation, resolve the previous one as interrupted
    if (this.currentResolve) {
      this.currentResolve(false);
    }

    this.stopInternal();

    this.currentAnimation = anim;
    this.animationName = name;
    this.currentResolve = resolve ?? null;

    this.frameIndex = 0;
    this.currentFrame = null;
    this.exiting = false;

    // Wrap the state change callback to handle queue progression
    this.onStateChange = (animName, state) => {
      try {
        onStateChange?.(animName, state);
      } catch (e) {
        console.error('Error in onStateChange callback:', e);
      }

      if (state === AnimatorState.EXITED) {
        if (this.currentResolve) {
          this.currentResolve(true);
          this.currentResolve = null;
        }
        this.processQueue();
      }
    };

    this.step();
    return true;
  }

  private stopInternal(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;

    this.currentAnimation = null;
    this.currentFrame = null;
    this.animationName = null;
  }

  private step = () => {
    if (!this.currentAnimation) return;

    const nextIndex = this.getNextFrameIndex();
    const clampedIndex = Math.min(nextIndex, this.currentAnimation.frames.length - 1);

    const frameChanged = !this.currentFrame || this.frameIndex !== clampedIndex;

    this.frameIndex = clampedIndex;
    this.currentFrame = this.currentAnimation.frames[this.frameIndex];

    if (!this.currentFrame) return;

    this.draw();

    if (this.currentFrame.sound) playSound(Number(this.currentFrame.sound));

    const duration = this.currentFrame.duration;
    this.timeout = window.setTimeout(this.step, duration);

    if (this.onStateChange && frameChanged && this.isLastFrame()) {
      if (this.currentAnimation.useExitBranching && !this.exiting) {
        this.onStateChange(this.animationName!, AnimatorState.WAITING);
      } else {
        this.onStateChange(this.animationName!, AnimatorState.EXITED);
      }
    }
  };

  private getNextFrameIndex(): number {
    if (!this.currentAnimation) return 0;
    if (!this.currentFrame) return 0;

    const frame = this.currentFrame;

    // Exit branch (highest priority)
    if (this.exiting && frame.exitBranch !== undefined) {
      return frame.exitBranch;
    }

    // Weighted branching
    if (frame.branching?.branches?.length) {
      let rnd = Math.random() * 100;

      for (const branch of frame.branching.branches) {
        if (rnd <= branch.weight) {
          return branch.frameIndex;
        }
        rnd -= branch.weight;
      }
    }

    return this.frameIndex + 1;
  }

  private isLastFrame(): boolean {
    if (!this.currentAnimation) return false;
    return this.frameIndex >= this.currentAnimation.frames.length - 1;
  }

  private draw(): void {
    if (!this.currentFrame?.images?.length) return;

    const [fw, fh] = this.sprite.frameSize;
    const [sx, sy] = this.currentFrame.images[0];

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.img, sx, sy, fw, fh, 0, 0, fw, fh);
  }
}
