import { dropAnimationFinished, guard } from '../../action-creators';
import type { State } from '../../../types';
import type { Middleware } from '../../store-types';
import type { EventBinding } from '../../../view/event-bindings/event-types';
import bindEvents from '../../../view/event-bindings/bind-events';

const dropAnimationFlushOnScrollMiddleware: Middleware = (store) => {
  let unbind: (() => void) | null = null;
  let frameId: AnimationFrameID | null = null;

  function clear() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }

    if (unbind) {
      unbind();
      unbind = null;
    }
  }

  return (next) => (action) => {
    if (
      guard(action, 'FLUSH') ||
      guard(action, 'DROP_COMPLETE') ||
      guard(action, 'DROP_ANIMATION_FINISHED')
    ) {
      clear();
    }

    next(action);

    if (!guard(action, 'DROP_ANIMATE')) {
      return;
    }

    const binding: EventBinding = {
      eventName: 'scroll',
      // capture: true will catch all scroll events, event from scroll containers
      // once: just in case, we only want to ever fire one
      options: { capture: true, passive: false, once: true },
      fn: function flushDropAnimation() {
        const state: State = store.getState();
        if (state.phase === 'DROP_ANIMATING') {
          store.dispatch(dropAnimationFinished());
        }
      },
    };

    // The browser can batch a few scroll events in a single frame
    // including the one that ended the drag.
    // Binding after a requestAnimationFrame ensures that any scrolls caused
    // by the auto scroller are finished
    // TODO: why is a second window scroll being fired?
    // It leads to funny drop positions :(
    frameId = requestAnimationFrame(() => {
      frameId = null;
      unbind = bindEvents(window, [binding]);
    });
  };
};

export default dropAnimationFlushOnScrollMiddleware;
