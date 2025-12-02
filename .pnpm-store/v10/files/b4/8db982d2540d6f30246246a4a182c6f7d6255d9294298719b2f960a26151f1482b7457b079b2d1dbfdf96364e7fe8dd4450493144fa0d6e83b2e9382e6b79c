import { invariant } from '../../../invariant';
import messagePreset from '../../../screen-reader-message-preset';
import * as timings from '../../../debug/timings';
import getExpiringAnnounce from './expiring-announce';
import type { ExpiringAnnounce } from './expiring-announce';
import getAsyncMarshal from './async-marshal';
import type { AsyncMarshal } from './async-marshal';
import type {
  DropResult,
  Responders,
  ResponderProvided,
  Critical,
  BeforeCapture,
  DragImpact,
  DraggableLocation,
  Combine,
  DragStart,
  Announce,
  DragUpdate,
  MovementMode,
  DraggableId,
  OnBeforeCaptureResponder,
  OnBeforeDragStartResponder,
} from '../../../types';
import { isCombineEqual, isCriticalEqual, areLocationsEqual } from './is-equal';
import { tryGetDestination, tryGetCombine } from '../../get-impact-location';

const withTimings = (key: string, fn: () => void) => {
  timings.start(key);
  fn();
  timings.finish(key);
};

const getDragStart = (critical: Critical, mode: MovementMode): DragStart => ({
  draggableId: critical.draggable.id,
  type: critical.droppable.type,

  source: {
    droppableId: critical.droppable.id,
    index: critical.draggable.index,
  },

  mode,
});

type AnyResponderData = DragStart | DragUpdate | DropResult;

type PrimaryResponderFn<TData extends AnyResponderData> = (
  data: TData,
  provided: ResponderProvided,
) => unknown;

type GetDefaultMessage<TData extends AnyResponderData> = (
  data: TData,
) => string;

function execute<TData extends AnyResponderData>(
  responder: PrimaryResponderFn<TData> | undefined,
  data: TData,
  announce: Announce,
  // eslint-disable-next-line no-shadow
  getDefaultMessage: GetDefaultMessage<TData>,
) {
  if (!responder) {
    announce(getDefaultMessage(data));
    return;
  }

  const willExpire: ExpiringAnnounce = getExpiringAnnounce(announce);
  const provided: ResponderProvided = {
    announce: willExpire,
  };

  // Casting because we are not validating which data type is going into which responder
  responder(data, provided);

  if (!willExpire.wasCalled()) {
    announce(getDefaultMessage(data));
  }
}

interface WhileDragging {
  mode: MovementMode;
  lastCritical: Critical;
  lastCombine: Combine | null;
  lastLocation: DraggableLocation | null;
}

export default (getResponders: () => Responders, announce: Announce) => {
  const asyncMarshal: AsyncMarshal = getAsyncMarshal();
  let dragging: WhileDragging | null = null;

  const beforeCapture = (draggableId: DraggableId, mode: MovementMode) => {
    invariant(
      !dragging,
      'Cannot fire onBeforeCapture as a drag start has already been published',
    );
    withTimings('onBeforeCapture', () => {
      // No use of screen reader for this responder
      const fn: OnBeforeCaptureResponder | undefined =
        getResponders().onBeforeCapture;
      if (fn) {
        const before: BeforeCapture = {
          draggableId,
          mode,
        };
        fn(before);
      }
    });
  };

  const beforeStart = (critical: Critical, mode: MovementMode) => {
    invariant(
      !dragging,
      'Cannot fire onBeforeDragStart as a drag start has already been published',
    );
    withTimings('onBeforeDragStart', () => {
      // No use of screen reader for this responder
      const fn: OnBeforeDragStartResponder | undefined =
        getResponders().onBeforeDragStart;
      if (fn) {
        fn(getDragStart(critical, mode));
      }
    });
  };

  const start = (critical: Critical, mode: MovementMode) => {
    invariant(
      !dragging,
      'Cannot fire onBeforeDragStart as a drag start has already been published',
    );
    const data: DragStart = getDragStart(critical, mode);
    dragging = {
      mode,
      lastCritical: critical,
      lastLocation: data.source,
      lastCombine: null,
    };

    // we will flush this frame if we receive any responder updates
    asyncMarshal.add(() => {
      withTimings('onDragStart', () =>
        execute(
          getResponders().onDragStart,
          data,
          announce,
          messagePreset.onDragStart,
        ),
      );
    });
  };

  // Passing in the critical location again as it can change during a drag
  const update = (critical: Critical, impact: DragImpact) => {
    const location: DraggableLocation | null = tryGetDestination(impact);
    const combine: Combine | null = tryGetCombine(impact);

    invariant(
      dragging,
      'Cannot fire onDragMove when onDragStart has not been called',
    );

    // Has the critical changed? Will result in a source change
    const hasCriticalChanged = !isCriticalEqual(
      critical,
      dragging.lastCritical,
    );
    if (hasCriticalChanged) {
      dragging.lastCritical = critical;
    }

    // Has the location changed? Will result in a destination change
    const hasLocationChanged = !areLocationsEqual(
      dragging.lastLocation,
      location,
    );
    if (hasLocationChanged) {
      dragging.lastLocation = location;
    }
    const hasGroupingChanged = !isCombineEqual(dragging.lastCombine, combine);
    if (hasGroupingChanged) {
      dragging.lastCombine = combine;
    }

    // Nothing has changed - no update needed
    if (!hasCriticalChanged && !hasLocationChanged && !hasGroupingChanged) {
      return;
    }

    const data: DragUpdate = {
      ...getDragStart(critical, dragging.mode),
      combine,
      destination: location,
    };

    asyncMarshal.add(() => {
      withTimings('onDragUpdate', () =>
        execute(
          getResponders().onDragUpdate,
          data,
          announce,
          messagePreset.onDragUpdate,
        ),
      );
    });
  };

  const flush = () => {
    invariant(dragging, 'Can only flush responders while dragging');
    asyncMarshal.flush();
  };

  const drop = (result: DropResult) => {
    invariant(
      dragging,
      'Cannot fire onDragEnd when there is no matching onDragStart',
    );
    dragging = null;
    // not adding to frame marshal - we want this to be done in the same render pass
    // we also want the consumers reorder logic to be in the same render pass
    withTimings('onDragEnd', () =>
      execute(
        getResponders().onDragEnd,
        result,
        announce,
        messagePreset.onDragEnd,
      ),
    );
  };

  // A non user initiated cancel
  const abort = () => {
    // aborting can happen defensively
    if (!dragging) {
      return;
    }

    const result: DropResult = {
      ...getDragStart(dragging.lastCritical, dragging.mode),
      combine: null,
      destination: null,
      reason: 'CANCEL',
    };
    drop(result);
  };

  return {
    beforeCapture,
    beforeStart,
    start,
    update,
    flush,
    drop,
    abort,
  };
};
