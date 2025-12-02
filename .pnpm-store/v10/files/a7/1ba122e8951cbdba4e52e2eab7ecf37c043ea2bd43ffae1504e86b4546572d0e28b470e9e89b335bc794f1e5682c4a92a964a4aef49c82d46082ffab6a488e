import type { State, StateWhenUpdatesAllowed } from '../types';
// Using function declaration as arrow function does not play well with the %checks syntax
export default function isMovementAllowed(
  state: State,
): state is StateWhenUpdatesAllowed {
  return state.phase === 'DRAGGING' || state.phase === 'COLLECTING';
}
