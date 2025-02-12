import type { StepResult, VariableReference } from './types';

export function isErrorEvent(stateEvent: any): stateEvent is {
  type: `xstate.error.actor.${string}`;
  error: Error;
} {
  return stateEvent.type.startsWith('xstate.error.actor.');
}

export function isTransitionEvent(stateEvent: any): stateEvent is {
  type: `xstate.done.actor.${string}`;
  output?: unknown;
} {
  return stateEvent.type.startsWith('xstate.done.actor.');
}

export function isVariableReference(value: any): value is VariableReference<any, any> {
  return typeof value === 'object' && 'step' in value && 'path' in value;
}

export function getStepResult(result?: StepResult<any>) {
  if (result?.status === 'success') return result.output;
  return undefined;
}
