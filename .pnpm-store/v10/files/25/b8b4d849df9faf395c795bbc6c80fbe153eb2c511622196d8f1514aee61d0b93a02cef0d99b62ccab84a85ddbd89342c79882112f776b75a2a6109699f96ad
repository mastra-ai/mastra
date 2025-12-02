import type { Position } from 'css-box-model';
import { moveByWindowScroll, guard } from '../action-creators';
import type { Middleware } from '../store-types';
import getScrollListener from '../../view/scroll-listener';

// TODO: this is taken from auto-scroll. Let's make it a util
const shouldStop = (action: unknown) =>
  guard(action, 'DROP_COMPLETE') ||
  guard(action, 'DROP_ANIMATE') ||
  guard(action, 'FLUSH');

const scrollListener: Middleware = (store) => {
  const listener = getScrollListener({
    onWindowScroll: (newScroll: Position) => {
      store.dispatch(moveByWindowScroll({ newScroll }));
    },
  });

  return (next) => (action) => {
    if (!listener.isActive() && guard(action, 'INITIAL_PUBLISH')) {
      listener.start();
    }

    if (listener.isActive() && shouldStop(action)) {
      listener.stop();
    }

    next(action);
  };
};

export default scrollListener;
