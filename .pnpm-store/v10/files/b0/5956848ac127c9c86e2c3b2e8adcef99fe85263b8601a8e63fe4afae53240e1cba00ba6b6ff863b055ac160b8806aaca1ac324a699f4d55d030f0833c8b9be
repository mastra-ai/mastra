import type { DropResult } from '../../types';
import type { Middleware } from '../store-types';
import { guard } from '../action-creators';
import type { FocusMarshal } from '../../view/use-focus-marshal/focus-marshal-types';

export default (marshal: FocusMarshal): Middleware => {
  let isWatching = false;

  return () => (next) => (action) => {
    if (guard(action, 'INITIAL_PUBLISH')) {
      isWatching = true;

      marshal.tryRecordFocus(action.payload.critical.draggable.id);
      next(action);
      marshal.tryRestoreFocusRecorded();
      return;
    }

    next(action);

    if (!isWatching) {
      return;
    }

    if (guard(action, 'FLUSH')) {
      isWatching = false;
      marshal.tryRestoreFocusRecorded();
      return;
    }

    if (guard(action, 'DROP_COMPLETE')) {
      isWatching = false;
      const result: DropResult = action.payload.completed.result;

      // give focus to the combine target when combining
      if (result.combine) {
        marshal.tryShiftRecord(result.draggableId, result.combine.draggableId);
      }
      marshal.tryRestoreFocusRecorded();
    }
  };
};
