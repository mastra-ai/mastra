import type {
  State,
  DraggingState,
  CollectingState,
  DropPendingState,
} from '../types';

export default function isDragging(
  state: State,
): state is DraggingState | CollectingState | DropPendingState {
  if (state.phase === 'IDLE' || state.phase === 'DROP_ANIMATING') {
    return false;
  }

  return state.isDragging;
}
