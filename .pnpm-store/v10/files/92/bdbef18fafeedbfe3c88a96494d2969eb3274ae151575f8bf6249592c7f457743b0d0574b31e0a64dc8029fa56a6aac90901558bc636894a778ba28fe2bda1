import { guard } from '../action-creators';
import type { Middleware } from '../store-types';
import type { DimensionMarshal } from '../dimension-marshal/dimension-marshal-types';

export default (marshal: DimensionMarshal): Middleware =>
  () =>
  (next) =>
  (action) => {
    // Not stopping a collection on a 'DROP' as we want a collection to continue
    if (
      // drag is finished
      guard(action, 'DROP_COMPLETE') ||
      guard(action, 'FLUSH') ||
      // no longer accepting changes once the drop has started
      guard(action, 'DROP_ANIMATE')
    ) {
      marshal.stopPublishing();
    }

    next(action);
  };
