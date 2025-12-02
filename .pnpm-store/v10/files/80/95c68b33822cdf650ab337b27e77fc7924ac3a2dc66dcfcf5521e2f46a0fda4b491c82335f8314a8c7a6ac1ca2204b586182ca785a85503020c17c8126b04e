import { invariant } from '../../invariant';
import type { AutoScroller } from '../auto-scroller/auto-scroller-types';
import type { Middleware } from '../store-types';
import { guard } from '../action-creators';
import type { State } from '../../types';

const shouldStop = (action: unknown) =>
  guard(action, 'DROP_COMPLETE') ||
  guard(action, 'DROP_ANIMATE') ||
  guard(action, 'FLUSH');

export default (autoScroller: AutoScroller): Middleware =>
  (store) =>
  (next) =>
  (action) => {
    if (shouldStop(action)) {
      autoScroller.stop();
      next(action);
      return;
    }

    if (guard(action, 'INITIAL_PUBLISH')) {
      // letting the action go first to hydrate the state
      next(action);
      const state: State = store.getState();
      invariant(
        state.phase === 'DRAGGING',
        'Expected phase to be DRAGGING after INITIAL_PUBLISH',
      );
      autoScroller.start(state);
      return;
    }

    // auto scroll happens in response to state changes
    // releasing all actions to the reducer first
    next(action);

    autoScroller.scroll(store.getState());
  };
