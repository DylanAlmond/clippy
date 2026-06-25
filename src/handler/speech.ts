/**
 * SpeechBubble class. Handles showing and hiding speech bubbles with text.
 */
export class SpeechBubble {
  constructor(private el: HTMLElement) {}

  show(text: string, duration = 5000) {
    this.el.textContent = text;
    this.el.hidden = false;

    if (duration > 0) {
      setTimeout(() => this.hide(), duration);
    }
  }

  hide() {
    this.el.hidden = true;
  }
}
