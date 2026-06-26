/**
 * SpeechBubble class. Handles showing and hiding speech bubbles with text.
 * Supports sequential queueing via async/await or fire-and-forget.
 */
export class SpeechBubble {
  private el: HTMLElement;

  private speechQueue: Array<{
    text: string;
    duration: number;
    resolve: () => void;
  }> = [];

  private currentTimeout: number | null = null;
  private currentResolve: (() => void) | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  // -------------------------
  // Public API
  // -------------------------

  /**
   * Shows a message immediately, interrupting and clearing the current queue.
   */
  show(text: string, duration = 5000): void {
    this.clearQueue();
    this.startMessage(text, duration, null);
  }

  /**
   * Queues a message to play after the current one finishes.
   * Returns a Promise that resolves when the message duration ends.
   */
  queue(text: string, duration = 5000): Promise<void> {
    return new Promise<void>((resolve) => {
      // If nothing is currently playing, start immediately
      if (!this.currentTimeout && this.speechQueue.length === 0 && this.el.hidden) {
        this.startMessage(text, duration, resolve);
      } else {
        // Add to queue
        this.speechQueue.push({ text, duration, resolve });
      }
    });
  }

  /**
   * Interrupts everything, clears the queue, and hides the bubble.
   */
  hide(): void {
    this.clearQueue();

    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    if (this.currentResolve) {
      this.currentResolve();
      this.currentResolve = null;
    }

    this.el.hidden = true;
  }

  // -------------------------
  // Core Logic
  // -------------------------

  private clearQueue() {
    // Resolve any pending queue promises as interrupted
    while (this.speechQueue.length > 0) {
      const item = this.speechQueue.shift();
      item?.resolve();
    }
  }

  private startMessage(text: string, duration: number, resolve: (() => void) | null) {
    // If we are starting a new message, resolve the previous one
    if (this.currentResolve) {
      this.currentResolve();
    }

    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
    }

    this.el.textContent = text;
    this.el.hidden = false;
    this.currentResolve = resolve;

    if (duration > 0) {
      this.currentTimeout = window.setTimeout(() => {
        this.finishCurrent();
      }, duration);
    } else {
      // If duration is 0, resolve immediately but leave text on screen
      this.currentResolve?.();
      this.currentResolve = null;
    }
  }

  private finishCurrent() {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    if (this.currentResolve) {
      this.currentResolve();
      this.currentResolve = null;
    }

    if (this.speechQueue.length > 0) {
      const next = this.speechQueue.shift()!;
      this.startMessage(next.text, next.duration, next.resolve);
    } else {
      // No more messages in queue, hide the bubble
      this.el.hidden = true;
    }
  }
}
