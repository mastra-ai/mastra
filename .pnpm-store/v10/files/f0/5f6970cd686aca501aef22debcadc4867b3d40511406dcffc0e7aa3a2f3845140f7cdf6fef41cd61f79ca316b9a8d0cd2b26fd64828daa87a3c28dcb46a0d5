import getPublisher from './publisher';
import type {
  State,
  DropResult,
  Responders,
  Critical,
  Announce,
} from '../../../types';
import type { Middleware } from '../../store-types';
import { guard } from '../../action-creators';

export default (
  getResponders: () => Responders,
  announce: Announce,
): Middleware => {
  const publisher = getPublisher(
    getResponders as () => Responders,
    announce as Announce,
  );

  return (store) => (next) => (action) => {
    if (guard(action, 'BEFORE_INITIAL_CAPTURE')) {
      publisher.beforeCapture(
        action.payload.draggableId,
        action.payload.movementMode,
      );
      return;
    }

    if (guard(action, 'INITIAL_PUBLISH')) {
      const critical: Critical = action.payload.critical;
      publisher.beforeStart(critical, action.payload.movementMode);
      next(action);
      publisher.start(critical, action.payload.movementMode);
      return;
    }

    // Drag end
    if (guard(action, 'DROP_COMPLETE')) {
      // it is important that we use the result and not the last impact
      // the last impact might be different to the result for visual reasons
      const result: DropResult = action.payload.completed.result;
      // flushing all pending responders before snapshots are updated
      publisher.flush();
      next(action);
      publisher.drop(result);
      return;
    }

    // All other responders can fire after we have updated our connected components
    next(action);

    // Drag state resetting - need to check if
    // we should fire a onDragEnd responder
    if (guard(action, 'FLUSH')) {
      publisher.abort();
      return;
    }

    // ## Perform drag updates
    // impact of action has already been reduced

    const state: State = store.getState();
    if (state.phase === 'DRAGGING') {
      publisher.update(state.critical, state.impact);
    }
  };
};
