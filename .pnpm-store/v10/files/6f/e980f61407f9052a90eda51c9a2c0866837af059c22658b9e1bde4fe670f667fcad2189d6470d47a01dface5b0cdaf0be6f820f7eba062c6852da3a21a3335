import { drop, guard } from '../action-creators';
import type { State } from '../../types';
import type { Middleware } from '../store-types';

const pendingDrop: Middleware = (store) => (next) => (action) => {
  // Always let the action go through first
  next(action);

  if (!guard(action, 'PUBLISH_WHILE_DRAGGING')) {
    return;
  }

  // A bulk replace occurred - check if
  // 1. there is a pending drop
  // 2. that the pending drop is no longer waiting

  const postActionState: State = store.getState();

  // no pending drop after the publish
  if (postActionState.phase !== 'DROP_PENDING') {
    return;
  }

  // the pending drop is still waiting for completion
  if (postActionState.isWaiting) {
    return;
  }

  store.dispatch(
    drop({
      reason: postActionState.reason,
    }),
  );
};

export default pendingDrop;
