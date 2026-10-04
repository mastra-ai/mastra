// React binds onAnimationEnd to `webkitAnimationEnd` when window.AnimationEvent is missing; jsdom lacks it.
class JsdomAnimationEvent extends Event {
  readonly animationName: string;
  readonly elapsedTime: number;
  readonly pseudoElement: string;

  constructor(type: string, init: AnimationEventInit = {}) {
    super(type, init);
    this.animationName = init.animationName ?? '';
    this.elapsedTime = init.elapsedTime ?? 0;
    this.pseudoElement = init.pseudoElement ?? '';
  }
}

if (typeof window !== 'undefined' && !('AnimationEvent' in window)) {
  Object.defineProperty(window, 'AnimationEvent', { value: JsdomAnimationEvent, configurable: true, writable: true });
}
