export { defineBehavior, normalizeBehavior } from './definition/normalize.js';
export { loadBehaviorDirectory } from './definition/loader.js';
export { BehaviorDefinitionError } from './definition/types.js';
export type {
  BehaviorDefinitionInput,
  BehaviorDiagnostic,
  BehaviorGuard,
  BehaviorStateInput,
  BehaviorTransitionInput,
  NormalizedBehaviorDefinition,
  NormalizedBehaviorState,
  NormalizedBehaviorTransition,
} from './definition/types.js';
