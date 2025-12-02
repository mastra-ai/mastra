import { guard } from '../action-creators';
import type { Middleware } from '../store-types';
import type { StyleMarshal } from '../../view/use-style-marshal/style-marshal-types';

export default (marshal: StyleMarshal): Middleware =>
  () =>
  (next) =>
  (action) => {
    if (guard(action, 'INITIAL_PUBLISH')) {
      marshal.dragging();
    }

    if (guard(action, 'DROP_ANIMATE')) {
      marshal.dropping(action.payload.completed.result.reason);
    }

    // this will clear any styles immediately before a reorder
    if (guard(action, 'FLUSH') || guard(action, 'DROP_COMPLETE')) {
      marshal.resting();
    }

    next(action);
  };
