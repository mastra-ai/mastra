import type { RuleCondition, RuleGroup } from '@mastra/factory/rules/rule-group';
import type { FilterBarField, FilterBarOperator, FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import type { RuleBuilderProps } from '@mastra/playground-ui/components/RuleBuilder';

export type Facts = RuleBuilderProps['schema'];

const CARD_FACT_PROPERTIES = {
  item: {
    type: 'object',
    title: 'Card',
    properties: {
      labels: { type: 'string', title: 'Labels' },
      title: { type: 'string', title: 'Title' },
      author: { type: 'string', title: 'Author' },
      key: { type: 'string', title: 'Key' },
      state: { type: 'string', title: 'State' },
      assignees: { type: 'string', title: 'Assignees' },
      pullRequest: { type: 'number', title: 'Open pull request' },
    },
  },
  author: { type: 'object', title: 'Author', properties: { trusted: { type: 'boolean', title: 'Trusted' } } },
  source: {
    type: 'object',
    title: 'Source',
    properties: {
      kind: { type: 'string', title: 'Kind' },
      integration: { type: 'string', title: 'Integration' },
      provider: { type: 'string', title: 'Provider' },
      // A GitHub repository or GitLab project path, a Linear team key (ENG), a Jira project key (PLAT).
      repository: { type: 'string', title: 'Repository, team or project' },
    },
  },
} satisfies Facts['properties'];

/** The card facts a phase rule can test (`CARD_RULE_FIELDS`), as the rule builder's field tree. */
export const CARD_FACTS: Facts = { type: 'object', properties: CARD_FACT_PROPERTIES };

/**
 * The facts an intake route can test (`INTAKE_ROUTE_RULE_FIELDS`): the card's, the status event a
 * route moves cards on, and the issue a pull request closes.
 */
const ROUTE_FACT_PROPERTIES = {
  ...CARD_FACT_PROPERTIES,
  pullRequest: {
    type: 'object',
    title: 'Pull request',
    properties: { closesIssue: { type: 'boolean', title: 'Closes an issue' } },
  },
  closedIssue: {
    type: 'object',
    title: 'Closed issue',
    properties: {
      phase: { type: 'string', title: 'Phase' },
      hasPullRequest: { type: 'boolean', title: 'Has a pull request' },
    },
  },
} as const;

/**
 * The facts an intake route handling `on` can test. As the route API requires, event facts
 * apply only to a route handling an event besides `work_item.opened`, and `event.reason` only
 * to one handling `work_item.closed`, the one event that carries a reason.
 */
export function intakeRouteFacts(on: readonly string[]): Facts {
  if (on.every(type => type === 'work_item.opened')) return { type: 'object', properties: ROUTE_FACT_PROPERTIES };
  const event = {
    type: { type: 'string', title: 'Type' },
    ...(on.includes('work_item.closed') ? { reason: { type: 'string', title: 'Reason' } } : {}),
  };
  return {
    type: 'object',
    properties: { ...ROUTE_FACT_PROPERTIES, event: { type: 'object', title: 'Event', properties: event } },
  };
}

/** Rule operators in words. Ids are the rule's own operators, so rows map back to rules unchanged. */
export const CONDITION_OPERATORS: FilterBarOperator[] = [
  { id: 'equals', label: 'is' },
  { id: 'not_equals', label: 'is not' },
  { id: 'in', label: 'is any of', arity: 'many' },
  { id: 'not_in', label: 'is none of', arity: 'many' },
  { id: 'contains', label: 'contains', freeText: true },
  { id: 'not_contains', label: 'does not contain', freeText: true },
  { id: 'exists', label: 'is set', arity: 'none' },
  { id: 'not_exists', label: 'is not set', arity: 'none' },
  { id: 'greater_than', label: 'is more than' },
  { id: 'less_than', label: 'is less than' },
  { id: 'greater_than_or_equal', label: 'is at least' },
  { id: 'less_than_or_equal', label: 'is at most' },
];

const TEXT_OPERATORS = ['equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'exists', 'not_exists'];
const CHOICE_OPERATORS = ['equals', 'not_equals', 'in', 'not_in'];
const NUMBER_OPERATORS = [
  'exists',
  'not_exists',
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
];
const BOOLEAN_OPERATORS = ['equals', 'not_equals'];
/** A list fact (labels, assignees) matches when one of its members does. */
const LIST_OPERATORS = ['equals', 'not_equals', 'in', 'not_in', 'exists', 'not_exists'];
const LIST_OPERATOR_LABELS: Record<string, string> = {
  equals: 'has',
  not_equals: 'does not have',
  in: 'has any of',
  not_in: 'has none of',
  exists: 'has any',
  not_exists: 'has none',
};

const INTEGRATIONS: FilterBarOption[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'linear', label: 'Linear' },
  { value: 'jira', label: 'Jira' },
  { value: 'incidentio', label: 'incident.io' },
];

const yesNo = (yes = 'Yes', no = 'No'): FilterBarOption[] => [
  { value: 'true', label: yes },
  { value: 'false', label: no },
];

type FieldShape = { label?: string; options?: FilterBarOption[]; strict?: boolean; list?: boolean };

/** What a value typed for a fact looks like, shown until one is typed. */
export const VALUE_PLACEHOLDERS: Record<string, string> = { 'source.repository': 'owner/repo, ENG, PLAT' };

/** Facts only tested for being there, such as a card's open pull request. */
const PRESENCE_OPERATORS = ['exists', 'not_exists'];
const PRESENCE_LABELS: Record<string, string> = { exists: 'exists', not_exists: 'does not exist' };
const PRESENCE_TEXT: Record<string, readonly [yes: string, no: string]> = {
  'item.pullRequest': ['card has an open pull request', 'card has no open pull request'],
};

/** How each fact reads in the condition editor, beyond its fact title. */
const FIELD_SHAPES: Record<string, FieldShape> = {
  'item.labels': { label: 'Labels', list: true },
  'item.title': { label: 'Title' },
  'item.author': { label: 'Author' },
  'item.key': { label: 'Key' },
  'item.state': { label: 'State' },
  'item.assignees': { label: 'Assignees', list: true },
  'item.pullRequest': { label: 'Open pull request' },
  'author.trusted': { label: 'Author trust', options: yesNo('Trusted', 'Outside author'), strict: true },
  'source.kind': {
    label: 'Source kind',
    options: [
      { value: 'issue', label: 'Issue' },
      { value: 'pull_request', label: 'Pull request' },
    ],
  },
  'source.integration': { label: 'Integration', options: INTEGRATIONS },
  'source.provider': { label: 'Provider', options: INTEGRATIONS },
  // Suggested from the project's repositories, teams and projects, but any value can be typed: `strict: false`.
  'source.repository': { label: 'Repository, team or project', strict: false },
  'pullRequest.closesIssue': { label: 'Pull request closes an issue', options: yesNo(), strict: true },
  'closedIssue.phase': { label: 'Closed issue phase' },
  'closedIssue.hasPullRequest': { label: 'Closed issue has a pull request', options: yesNo(), strict: true },
  'event.type': {
    label: 'Event',
    strict: true,
    options: [
      { value: 'work_item.opened', label: 'New card' },
      { value: 'work_item.closed', label: 'Closed' },
      { value: 'work_item.reopened', label: 'Reopened' },
      { value: 'pull_request.opened', label: 'PR opened' },
      { value: 'pull_request.synchronized', label: 'PR updated' },
      { value: 'pull_request.review_requested', label: 'Review requested' },
      { value: 'pull_request.merged', label: 'PR merged' },
      { value: 'pull_request.closed', label: 'PR closed' },
    ],
  },
  'event.reason': {
    label: 'Close reason',
    strict: true,
    options: [
      { value: 'completed', label: 'Completed' },
      { value: 'canceled', label: 'Not planned' },
    ],
  },
};

/**
 * The facts a rule can test, as condition editor fields: one per leaf fact, with its values to
 * pick from when they are known. `options` adds values per field, such as a board's phases.
 */
export function conditionFields(facts: Facts, options: Record<string, FilterBarOption[]> = {}): FilterBarField[] {
  return Object.entries(facts.properties ?? {}).flatMap(([group, groupFact]) =>
    Object.entries(groupFact.properties ?? {}).map(([property, fact]): FilterBarField => {
      const id = `${group}.${property}`;
      const shape = FIELD_SHAPES[id] ?? {};
      const label = shape.label ?? `${groupFact.title ?? group} ${(fact.title ?? property).toLowerCase()}`;
      const suggestions = options[id] ?? shape.options;
      if (fact.type === 'boolean') {
        return { id, label, type: 'boolean', operators: BOOLEAN_OPERATORS, suggestions, strict: true };
      }
      if (PRESENCE_TEXT[id]) return { id, label, operators: PRESENCE_OPERATORS, operatorLabels: PRESENCE_LABELS };
      if (fact.type === 'number') return { id, label, type: 'number', operators: NUMBER_OPERATORS };
      if (shape.list) {
        return { id, label, operators: LIST_OPERATORS, operatorLabels: LIST_OPERATOR_LABELS, suggestions };
      }
      return {
        id,
        label,
        operators: suggestions && shape.strict !== false ? CHOICE_OPERATORS : TEXT_OPERATORS,
        suggestions,
        strict: shape.strict,
      };
    }),
  );
}

/** Yes/no facts read as a phrase, since "Author trust is trusted" says less than "author is trusted". */
const BOOLEAN_TEXT: Record<string, readonly [yes: string, no: string]> = {
  'author.trusted': ['author is trusted', 'author is not trusted'],
  'pullRequest.closesIssue': ['pull request closes an issue', 'pull request closes no issue'],
  'closedIssue.hasPullRequest': ['closed issue has a pull request', 'closed issue has no pull request'],
};

/** Values named after a product or a phase keep their capitals mid-sentence. */
const PROPER_VALUES = new Set(['source.integration', 'source.provider', 'closedIssue.phase']);

const EVERY_FACT = intakeRouteFacts(['work_item.opened', 'work_item.closed']);

function describeMember(member: RuleCondition | RuleGroup, fields: ReadonlyMap<string, FilterBarField>): string {
  if ('conditions' in member) return `(${describeMembers(member, fields)})`;
  const phrase = BOOLEAN_TEXT[member.field];
  if (phrase && typeof member.value === 'boolean') {
    const yes = (member.operator === 'equals') === member.value;
    if (member.operator === 'equals' || member.operator === 'not_equals') return yes ? phrase[0] : phrase[1];
  }
  const presence = PRESENCE_TEXT[member.field];
  if (presence && (member.operator === 'exists' || member.operator === 'not_exists')) {
    return member.operator === 'exists' ? presence[0] : presence[1];
  }
  const field = fields.get(member.field);
  const fact = field ? field.label.charAt(0).toLowerCase() + field.label.slice(1) : member.field;
  const operator =
    field?.operatorLabels?.[member.operator] ??
    CONDITION_OPERATORS.find(candidate => candidate.id === member.operator)?.label ??
    member.operator;
  if (member.value === undefined) return `${fact} ${operator}`;
  const options = Array.isArray(field?.suggestions) ? field.suggestions : [];
  const values = (Array.isArray(member.value) ? member.value : [member.value]).map(value => {
    const text = options.find(option => option.value === String(value))?.label ?? String(value);
    if (PROPER_VALUES.has(member.field) || text.charAt(1) !== text.charAt(1).toLowerCase()) return text;
    return text.charAt(0).toLowerCase() + text.slice(1);
  });
  if (member.operator === 'in') return `${fact} ${field?.operatorLabels?.equals ?? 'is'} ${values.join(' or ')}`;
  return `${fact} ${operator} ${values.join(', ')}`;
}

function describeMembers(group: RuleGroup, fields: ReadonlyMap<string, FilterBarField>): string {
  return group.conditions
    .map(member => describeMember(member, fields))
    .join(group.operator === 'AND' ? ' and ' : ' or ');
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A rule's top-level conditions, one phrase each, and how they combine; `null` when it matches every card. */
export function describeConditions(
  rule: RuleGroup | null | undefined,
  options: Record<string, FilterBarOption[]> = {},
): { join: 'and' | 'or'; parts: string[] } | null {
  if (!rule || rule.conditions.length === 0) return null;
  const fields = new Map(conditionFields(EVERY_FACT, options).map(field => [field.id, field]));
  return {
    join: rule.operator === 'AND' ? 'and' : 'or',
    parts: rule.conditions.map(member => capitalize(describeMember(member, fields))),
  };
}

/**
 * A rule in words, naming facts, operators and values as the condition chips do; no rule matches
 * every card. `options` names values per field, such as a board's phases.
 */
export function describeRule(
  rule: RuleGroup | null | undefined,
  options: Record<string, FilterBarOption[]> = {},
): string {
  if (!rule || rule.conditions.length === 0) return 'Every card';
  const fields = new Map(conditionFields(EVERY_FACT, options).map(field => [field.id, field]));
  const text = describeMembers(rule, fields);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
