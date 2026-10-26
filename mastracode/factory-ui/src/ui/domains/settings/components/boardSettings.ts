import type { StoredBoardConfig, StoredBoardInfo, StoredIntakeRouteInfo } from '../../../../api/types';

export type RuleGroup = NonNullable<StoredIntakeRouteInfo['when']>;
export type RuleNode = RuleGroup['conditions'][number];
export type RuleCondition = Extract<RuleNode, { field: string }>;
export type RuleOperator = RuleCondition['operator'];
export type StoredPhase = StoredBoardInfo['phases'][number];
export type StoredEventRoute = StoredBoardInfo['eventRoutes'][number];

export interface FieldOption {
  value: string;
  title: string;
  type: 'text' | 'list' | 'boolean';
}

/** Card fields a phase's auto-approve condition can test (see `cardRuleFacts`). */
export const CARD_FIELDS: FieldOption[] = [
  { value: 'item.labels', title: 'Labels', type: 'list' },
  { value: 'item.title', title: 'Title', type: 'text' },
  { value: 'item.author', title: 'Author', type: 'text' },
  { value: 'source.kind', title: 'Source kind (issue, pull_request)', type: 'text' },
  { value: 'source.integration', title: 'Integration (github, gitlab, …)', type: 'text' },
];

/** Fields an intake route can test. */
export const INTAKE_FIELDS: FieldOption[] = [
  ...CARD_FIELDS,
  { value: 'source.repository', title: 'Repository', type: 'text' },
  { value: 'source.team', title: 'Team', type: 'text' },
  { value: 'source.project', title: 'Project', type: 'text' },
  { value: 'item.authorTrusted', title: 'Author is trusted', type: 'boolean' },
  { value: 'item.draft', title: 'Is draft', type: 'boolean' },
];

/** Fields an event route can test. */
export const EVENT_FIELDS: FieldOption[] = [
  { value: 'pullRequest.merged', title: 'PR merged', type: 'boolean' },
  { value: 'pullRequest.draft', title: 'PR is draft', type: 'boolean' },
  { value: 'pullRequest.factoryAuthored', title: 'PR opened by Factory', type: 'boolean' },
  { value: 'issue.stateReason', title: 'Issue close reason', type: 'text' },
  { value: 'item.hasOtherOpenPullRequest', title: 'Card has another open PR', type: 'boolean' },
  { value: 'actor.trusted', title: 'Actor is trusted', type: 'boolean' },
  { value: 'item.sourceKind', title: 'Card source kind', type: 'text' },
];

export const BOARD_EVENTS = [
  'pull_request.opened',
  'pull_request.merged',
  'pull_request.closed',
  'pull_request.review_requested',
  'pull_request.updated',
  'issue.closed',
] as const;

const ALL_OPERATORS: { value: RuleOperator; title: string }[] = [
  { value: 'equals', title: 'is' },
  { value: 'not_equals', title: 'is not' },
  { value: 'contains', title: 'contains' },
  { value: 'not_contains', title: 'does not contain' },
  { value: 'in', title: 'is one of' },
  { value: 'not_in', title: 'is not one of' },
  { value: 'exists', title: 'is set' },
  { value: 'not_exists', title: 'is not set' },
];

export function operatorsFor(type: FieldOption['type']) {
  if (type === 'boolean') return ALL_OPERATORS.filter(op => op.value === 'equals' || op.value === 'not_equals');
  if (type === 'list') return ALL_OPERATORS.filter(op => !['equals', 'not_equals', 'in', 'not_in'].includes(op.value));
  return ALL_OPERATORS;
}

export function needsValue(operator: RuleOperator): boolean {
  return operator !== 'exists' && operator !== 'not_exists';
}

export function isListOperator(operator: RuleOperator): boolean {
  return operator === 'in' || operator === 'not_in';
}

/** The value text an input shows for a condition. */
export function valueText(condition: RuleCondition): string {
  const value = condition.value;
  if (Array.isArray(value)) return value.join(', ');
  return value === undefined ? '' : String(value);
}

/** Typed text → the stored value for this operator and field type. */
export function parseValue(text: string, operator: RuleOperator, type: FieldOption['type']): RuleCondition['value'] {
  if (!needsValue(operator)) return undefined;
  if (isListOperator(operator)) return parseList(text) ?? [];
  if (type === 'boolean') return text === 'true';
  return text;
}

export function newCondition(fields: FieldOption[]): RuleCondition {
  const field = fields[0];
  return {
    field: field.value,
    operator: field.type === 'list' ? 'contains' : 'equals',
    value: field.type === 'boolean' ? true : '',
  };
}

/** Comma-separated text → trimmed, de-duplicated entries; `null` when nothing is left. */
export function parseList(text: string): string[] | null {
  const entries = [
    ...new Set(
      text
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean),
    ),
  ];
  return entries.length ? entries : null;
}

export function listText(list: readonly string[] | null | undefined): string {
  return list?.join(', ') ?? '';
}

/** Short human text for a condition (shown next to routes). */
export function describeCondition(group: RuleGroup | null, fields: FieldOption[]): string {
  if (!group) return 'Everything else';
  const parts = group.conditions.map(node => {
    if (!('field' in node)) return `(${describeCondition(node, fields)})`;
    const field = fields.find(option => option.value === node.field)?.title ?? node.field;
    const op = ALL_OPERATORS.find(option => option.value === node.operator)?.title ?? node.operator;
    return needsValue(node.operator) ? `${field} ${op} ${valueText(node)}` : `${field} ${op}`;
  });
  return parts.join(group.operator === 'AND' ? ' and ' : ' or ') || 'Always';
}

/**
 * Renames a phase key across the config: next phases, event routes and intake routes
 * that pointed at the old key point at the new one.
 */
export function renamePhase(config: StoredBoardConfig, boardKey: string, from: string, to: string): StoredBoardConfig {
  const swap = (key: string) => (key === from ? to : key);
  return {
    ...config,
    boards: config.boards.map(board =>
      board.key !== boardKey
        ? board
        : {
            ...board,
            phases: board.phases.map(phase => ({
              ...phase,
              key: swap(phase.key),
              nextPhases: phase.nextPhases?.map(swap) ?? null,
            })),
            eventRoutes: board.eventRoutes.map(route => ({
              ...route,
              toPhaseKey: swap(route.toPhaseKey),
              fromPhases: route.fromPhases?.map(swap) ?? null,
            })),
          },
    ),
    intakeRoutes: config.intakeRoutes.map(route =>
      route.boardKey === boardKey && route.phaseKey === from ? { ...route, phaseKey: to } : route,
    ),
  };
}

/** Removes a phase and every reference to it. */
export function removePhase(config: StoredBoardConfig, boardKey: string, key: string): StoredBoardConfig {
  const drop = (keys: string[] | null) => {
    if (!keys) return null;
    const left = keys.filter(entry => entry !== key);
    return left.length ? left : null;
  };
  return {
    ...config,
    boards: config.boards.map(board =>
      board.key !== boardKey
        ? board
        : {
            ...board,
            phases: board.phases
              .filter(phase => phase.key !== key)
              .map(phase => ({ ...phase, nextPhases: drop(phase.nextPhases) })),
            eventRoutes: board.eventRoutes
              .filter(route => route.toPhaseKey !== key)
              .map(route => ({ ...route, fromPhases: drop(route.fromPhases) })),
          },
    ),
    intakeRoutes: config.intakeRoutes.map(route =>
      route.boardKey === boardKey && route.phaseKey === key ? { ...route, phaseKey: null } : route,
    ),
  };
}

export function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
