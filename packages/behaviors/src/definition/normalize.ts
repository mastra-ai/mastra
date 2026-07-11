import type {
  BehaviorDefinitionInput,
  BehaviorDiagnostic,
  NormalizedBehaviorDefinition,
  NormalizedBehaviorState,
} from './types.js';
import { BehaviorDefinitionError } from './types.js';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function defineBehavior(input: BehaviorDefinitionInput): NormalizedBehaviorDefinition {
  return normalizeBehavior(input);
}

export function normalizeBehavior(input: BehaviorDefinitionInput, root?: string): NormalizedBehaviorDefinition {
  const diagnostics: BehaviorDiagnostic[] = [];
  if (!input.id?.trim()) diagnostics.push({ path: 'id', message: 'must be a non-empty string' });
  else if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(input.id)) diagnostics.push({ path: 'id', message: 'may contain only letters, numbers, dots, underscores, and hyphens' });
  if (!input.version?.trim()) diagnostics.push({ path: 'version', message: 'must be a non-empty string' });
  if (!Array.isArray(input.states) || input.states.length === 0) {
    diagnostics.push({ path: 'states', message: 'must contain at least one state' });
  }

  const states: Record<string, NormalizedBehaviorState> = {};
  for (const [stateIndex, state] of (input.states ?? []).entries()) {
    const statePath = `states[${stateIndex}]`;
    if (!state.id?.trim()) {
      diagnostics.push({ path: `${statePath}.id`, message: 'must be a non-empty string' });
      continue;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(state.id)) {
      diagnostics.push({ path: `${statePath}.id`, message: 'may contain only letters, numbers, dots, underscores, and hyphens' });
      continue;
    }
    if (states[state.id]) {
      diagnostics.push({ path: `${statePath}.id`, message: `duplicate state ID "${state.id}"` });
      continue;
    }
    const transitionIds = new Set<string>();
    for (const [transitionIndex, transition] of (state.transitions ?? []).entries()) {
      const transitionPath = `${statePath}.transitions[${transitionIndex}]`;
      if (!transition.id?.trim()) diagnostics.push({ path: `${transitionPath}.id`, message: 'must be non-empty' });
      if (transitionIds.has(transition.id)) {
        diagnostics.push({ path: `${transitionPath}.id`, message: `duplicate transition ID "${transition.id}"` });
      }
      transitionIds.add(transition.id);
      if (transition.guards) {
        const guards = new Set<string>();
        for (const guard of transition.guards) {
          if (guards.has(guard.id)) diagnostics.push({ path: `${transitionPath}.guards`, message: `duplicate guard ID "${guard.id}"` });
          guards.add(guard.id);
        }
      }
    }
    states[state.id] = {
      id: state.id,
      description: state.description,
      instructions: state.instructions,
      judgeInstructions: state.judgeInstructions,
      skills: [...(state.skills ?? [])],
      tools: [...(state.tools ?? [])],
      model: state.model,
      judgeModel: state.judgeModel,
      periodic: state.periodic ? { ...state.periodic } : undefined,
      transitions: (state.transitions ?? []).map(transition => ({
        ...transition,
        guards: [...(transition.guards ?? [])],
        judge: transition.judge ?? false,
        exit: transition.exit ?? false,
      })),
    };
  }

  if (!states[input.initialState]) diagnostics.push({ path: 'initialState', message: `unknown state "${input.initialState}"` });
  for (const state of Object.values(states)) {
    if (!state.transitions.some(transition => transition.exit)) {
      diagnostics.push({ path: `states.${state.id}.transitions`, message: 'must include an exit transition' });
    }
    if (state.periodic) {
      if (!Number.isFinite(state.periodic.intervalMs) || state.periodic.intervalMs <= 0) {
        diagnostics.push({ path: `states.${state.id}.periodic.intervalMs`, message: 'must be a positive number' });
      }
      if (!state.transitions.some(transition => transition.id === state.periodic?.transition)) {
        diagnostics.push({ path: `states.${state.id}.periodic.transition`, message: 'must reference a transition in this state' });
      }
    }
    for (const transition of state.transitions) {
      if (!transition.exit && !states[transition.target]) {
        diagnostics.push({ path: `states.${state.id}.transitions.${transition.id}.target`, message: `unknown state "${transition.target}"` });
      }
    }
  }

  if (states[input.initialState]) {
    const reachable = new Set<string>();
    const pending = [input.initialState];
    while (pending.length) {
      const id = pending.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const transition of states[id]?.transitions ?? []) if (!transition.exit) pending.push(transition.target);
    }
    for (const id of Object.keys(states)) {
      if (!reachable.has(id)) diagnostics.push({ path: `states.${id}`, message: 'state is unreachable from initialState' });
    }
  }

  for (const [from, to] of Object.entries(input.migrations ?? {})) {
    if (!from.trim()) diagnostics.push({ path: 'migrations', message: 'migration source must be non-empty' });
    if (!states[to]) diagnostics.push({ path: `migrations.${from}`, message: `unknown target state "${to}"` });
  }

  if (diagnostics.length) throw new BehaviorDefinitionError(diagnostics);
  return deepFreeze({ id: input.id, version: input.version, root, initialState: input.initialState, states, migrations: { ...(input.migrations ?? {}) } });
}
