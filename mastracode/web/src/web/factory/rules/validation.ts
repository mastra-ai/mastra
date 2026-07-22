import {
  FACTORY_GITHUB_EVENTS,
  FACTORY_LINEAR_EVENTS,
  FACTORY_RULE_BOARDS,
  FACTORY_RULE_SOURCES,
  FACTORY_RULE_STAGES,
} from './types.js';
import type {
  FactoryBoardRules,
  FactoryCommitDecision,
  FactoryRuleDecision,
  FactoryRuleJsonValue,
  FactoryRules,
  FactoryRuleRejectionCode,
  WorkItemSource,
} from './types.js';

export const MAX_FACTORY_RULE_CAUSAL_DEPTH = 8;

const MAX_VERSION_LENGTH = 128;
const MAX_IDEMPOTENCY_KEY_LENGTH = 256;
const MAX_REASON_LENGTH = 512;
const MAX_TITLE_LENGTH = 512;
const MAX_MESSAGE_LENGTH = 8_192;
const MAX_ARGUMENTS_LENGTH = 4_096;
const MAX_ROLE_LENGTH = 32;
const MAX_SKILL_NAME_LENGTH = 128;
const MAX_SOURCE_KEY_LENGTH = 256;
const MAX_URL_LENGTH = 2_048;
const MAX_METADATA_JSON_LENGTH = 16_384;
const MAX_JSON_DEPTH = 8;
const MAX_JSON_COLLECTION_SIZE = 100;

const IDENTIFIER_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SENSITIVE_KEY_RE = /(?:authorization|cookie|credential|password|secret|token)/i;
const WORK_ITEM_SOURCES: readonly WorkItemSource[] = ['github-issue', 'github-pr', 'linear-issue', 'manual'];
const REJECTION_CODES: readonly FactoryRuleRejectionCode[] = [
  'forbidden',
  'invalid_transition',
  'missing_binding',
  'stale',
  'timeout',
  'rule_error',
  'causal_depth_exceeded',
  'repeated_transition',
];

export class FactoryRuleValidationError extends Error {
  readonly code = 'invalid_factory_rule';

  constructor(message: string) {
    super(message);
    this.name = 'FactoryRuleValidationError';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const allowed = new Set(keys);
  if (Object.keys(value).some(key => !allowed.has(key))) {
    throw new FactoryRuleValidationError(`${label} contains an unsupported field.`);
  }
}

function boundedString(value: unknown, label: string, max: number, pattern?: RegExp): string {
  if (typeof value !== 'string') throw new FactoryRuleValidationError(`${label} must be a string.`);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > max || (pattern && !pattern.test(normalized))) {
    throw new FactoryRuleValidationError(`${label} is invalid.`);
  }
  return normalized;
}

function optionalBoundedString(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  return boundedString(value, label, max);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new FactoryRuleValidationError(`${label} is invalid.`);
  }
  return value as T;
}

export function normalizeFactoryRuleJsonValue(
  value: unknown,
  depth = 0,
  seen = new Set<object>(),
): FactoryRuleJsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new FactoryRuleValidationError('Rule metadata must contain finite numbers.');
    return value;
  }
  if (depth >= MAX_JSON_DEPTH || (typeof value !== 'object' && !Array.isArray(value))) {
    throw new FactoryRuleValidationError('Rule metadata is not bounded JSON.');
  }
  if (seen.has(value as object)) throw new FactoryRuleValidationError('Rule metadata must not contain cycles.');
  seen.add(value as object);
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_JSON_COLLECTION_SIZE) {
        throw new FactoryRuleValidationError('Rule metadata contains too many entries.');
      }
      return value.map(entry => normalizeFactoryRuleJsonValue(entry, depth + 1, seen));
    }
    if (!isPlainObject(value)) throw new FactoryRuleValidationError('Rule metadata must use plain objects.');
    const entries = Object.entries(value);
    if (entries.length > MAX_JSON_COLLECTION_SIZE) {
      throw new FactoryRuleValidationError('Rule metadata contains too many fields.');
    }
    const sanitized: Record<string, FactoryRuleJsonValue> = {};
    for (const [key, entry] of entries) {
      const normalizedKey = boundedString(key, 'Rule metadata key', 128, IDENTIFIER_RE);
      sanitized[normalizedKey] = SENSITIVE_KEY_RE.test(normalizedKey)
        ? '[REDACTED]'
        : normalizeFactoryRuleJsonValue(entry, depth + 1, seen);
    }
    return sanitized;
  } finally {
    seen.delete(value as object);
  }
}

function sanitizeMetadata(value: unknown): Record<string, FactoryRuleJsonValue> | undefined {
  if (value === undefined) return undefined;
  const sanitized = normalizeFactoryRuleJsonValue(value);
  if (!isPlainObject(sanitized)) throw new FactoryRuleValidationError('Rule metadata must be an object.');
  if (JSON.stringify(sanitized).length > MAX_METADATA_JSON_LENGTH) {
    throw new FactoryRuleValidationError('Rule metadata is too large.');
  }
  return sanitized;
}

function validateBoardRules(rules: unknown, label: string): asserts rules is FactoryBoardRules {
  if (!isPlainObject(rules)) throw new FactoryRuleValidationError(`${label} must be an object.`);
  for (const [stage, sources] of Object.entries(rules)) {
    enumValue(stage, FACTORY_RULE_STAGES, `${label} stage`);
    if (!isPlainObject(sources)) throw new FactoryRuleValidationError(`${label}.${stage} must be an object.`);
    for (const [source, leaf] of Object.entries(sources)) {
      enumValue(source, FACTORY_RULE_SOURCES, `${label}.${stage} source`);
      if (!isPlainObject(leaf)) throw new FactoryRuleValidationError(`${label}.${stage}.${source} must be an object.`);
      assertExactKeys(leaf, ['onEnter', 'onExit'], `${label}.${stage}.${source}`);
      for (const handler of Object.values(leaf)) {
        if (handler !== undefined && typeof handler !== 'function') {
          throw new FactoryRuleValidationError(`${label}.${stage}.${source} handlers must be functions.`);
        }
      }
    }
  }
}

export function assertFactoryRules(rules: unknown): asserts rules is FactoryRules {
  if (!isPlainObject(rules)) throw new FactoryRuleValidationError('Factory rules must be an object.');
  assertExactKeys(rules, ['version', 'work', 'review', 'tools', 'github', 'linear'], 'Factory rules');
  boundedString(rules.version, 'Factory rule version', MAX_VERSION_LENGTH);
  validateBoardRules(rules.work, 'Factory rules.work');
  validateBoardRules(rules.review, 'Factory rules.review');

  if (!isPlainObject(rules.tools)) throw new FactoryRuleValidationError('Factory rules.tools must be an object.');
  for (const [toolName, leaf] of Object.entries(rules.tools)) {
    boundedString(toolName, 'Factory tool name', 128, IDENTIFIER_RE);
    if (!isPlainObject(leaf))
      throw new FactoryRuleValidationError(`Factory rules.tools.${toolName} must be an object.`);
    assertExactKeys(leaf, ['onResult'], `Factory rules.tools.${toolName}`);
    if (leaf.onResult !== undefined && typeof leaf.onResult !== 'function') {
      throw new FactoryRuleValidationError(`Factory rules.tools.${toolName}.onResult must be a function.`);
    }
  }

  if (!isPlainObject(rules.github)) throw new FactoryRuleValidationError('Factory rules.github must be an object.');
  for (const [event, leaf] of Object.entries(rules.github)) {
    enumValue(event, FACTORY_GITHUB_EVENTS, 'Factory GitHub event');
    if (!isPlainObject(leaf)) throw new FactoryRuleValidationError(`Factory rules.github.${event} must be an object.`);
    assertExactKeys(leaf, ['onEvent'], `Factory rules.github.${event}`);
    if (leaf.onEvent !== undefined && typeof leaf.onEvent !== 'function') {
      throw new FactoryRuleValidationError(`Factory rules.github.${event}.onEvent must be a function.`);
    }
  }

  if (!isPlainObject(rules.linear)) throw new FactoryRuleValidationError('Factory rules.linear must be an object.');
  for (const [event, leaf] of Object.entries(rules.linear)) {
    enumValue(event, FACTORY_LINEAR_EVENTS, 'Factory Linear event');
    if (!isPlainObject(leaf)) throw new FactoryRuleValidationError(`Factory rules.linear.${event} must be an object.`);
    assertExactKeys(leaf, ['onEvent'], `Factory rules.linear.${event}`);
    if (leaf.onEvent !== undefined && typeof leaf.onEvent !== 'function') {
      throw new FactoryRuleValidationError(`Factory rules.linear.${event}.onEvent must be a function.`);
    }
  }
}

function commonCommitFields(value: Record<string, unknown>): { idempotencyKey: string } {
  return {
    idempotencyKey: boundedString(value.idempotencyKey, 'Factory decision idempotencyKey', MAX_IDEMPOTENCY_KEY_LENGTH),
  };
}

export function validateFactoryRuleDecision(value: unknown, causalDepth = 0): FactoryRuleDecision {
  if (causalDepth > MAX_FACTORY_RULE_CAUSAL_DEPTH) {
    throw new FactoryRuleValidationError('Factory rule causal depth exceeded.');
  }
  if (!isPlainObject(value)) throw new FactoryRuleValidationError('Factory rule decision must be an object.');
  const type = value.type;
  if (typeof type !== 'string') throw new FactoryRuleValidationError('Factory rule decision type is required.');

  switch (type) {
    case 'reject': {
      assertExactKeys(value, ['type', 'code', 'reason'], 'Factory reject decision');
      return {
        type,
        code: enumValue(value.code, REJECTION_CODES, 'Factory rejection code'),
        reason: boundedString(value.reason, 'Factory rejection reason', MAX_REASON_LENGTH),
      };
    }
    case 'transition': {
      assertExactKeys(value, ['type', 'idempotencyKey', 'board', 'stage'], 'Factory transition decision');
      return {
        type,
        ...commonCommitFields(value),
        board: enumValue(value.board, FACTORY_RULE_BOARDS, 'Factory transition board'),
        stage: enumValue(value.stage, FACTORY_RULE_STAGES, 'Factory transition stage'),
      };
    }
    case 'upsertLinkedWorkItem': {
      assertExactKeys(
        value,
        ['type', 'idempotencyKey', 'board', 'source', 'sourceKey', 'title', 'url', 'stage', 'metadata'],
        'Factory linked work item decision',
      );
      const url = value.url;
      if (url !== null && (typeof url !== 'string' || url.length > MAX_URL_LENGTH || !/^https?:\/\//.test(url))) {
        throw new FactoryRuleValidationError('Factory linked work item URL is invalid.');
      }
      const metadata = sanitizeMetadata(value.metadata);
      return {
        type,
        ...commonCommitFields(value),
        board: enumValue(value.board, FACTORY_RULE_BOARDS, 'Factory linked work item board'),
        source: enumValue(value.source, WORK_ITEM_SOURCES, 'Factory linked work item source'),
        sourceKey: boundedString(value.sourceKey, 'Factory linked work item sourceKey', MAX_SOURCE_KEY_LENGTH),
        title: boundedString(value.title, 'Factory linked work item title', MAX_TITLE_LENGTH),
        url,
        stage: enumValue(value.stage, FACTORY_RULE_STAGES, 'Factory linked work item stage'),
        ...(metadata ? { metadata } : {}),
      };
    }
    case 'invokeSkill': {
      assertExactKeys(
        value,
        ['type', 'idempotencyKey', 'role', 'skillName', 'arguments'],
        'Factory invoke skill decision',
      );
      const args = optionalBoundedString(value.arguments, 'Factory skill arguments', MAX_ARGUMENTS_LENGTH);
      return {
        type,
        ...commonCommitFields(value),
        role: boundedString(value.role, 'Factory skill role', MAX_ROLE_LENGTH, IDENTIFIER_RE),
        skillName: boundedString(value.skillName, 'Factory skill name', MAX_SKILL_NAME_LENGTH, SKILL_NAME_RE),
        ...(args ? { arguments: args } : {}),
      };
    }
    case 'sendMessage': {
      assertExactKeys(value, ['type', 'idempotencyKey', 'role', 'message'], 'Factory send message decision');
      return {
        type,
        ...commonCommitFields(value),
        role: boundedString(value.role, 'Factory message role', MAX_ROLE_LENGTH, IDENTIFIER_RE),
        message: boundedString(value.message, 'Factory message', MAX_MESSAGE_LENGTH),
      };
    }
    case 'notify': {
      assertExactKeys(value, ['type', 'idempotencyKey', 'title', 'body', 'level'], 'Factory notify decision');
      const body = optionalBoundedString(value.body, 'Factory notification body', MAX_MESSAGE_LENGTH);
      const level =
        value.level === undefined
          ? undefined
          : enumValue(value.level, ['info', 'warning', 'error'] as const, 'Factory notification level');
      return {
        type,
        ...commonCommitFields(value),
        title: boundedString(value.title, 'Factory notification title', MAX_TITLE_LENGTH),
        ...(body ? { body } : {}),
        ...(level ? { level } : {}),
      };
    }
    default:
      throw new FactoryRuleValidationError('Factory rule decision type is unsupported.');
  }
}

export function validateFactoryRuleDecisions(values: readonly unknown[], causalDepth = 0): FactoryCommitDecision[] {
  if (values.length > MAX_JSON_COLLECTION_SIZE) {
    throw new FactoryRuleValidationError('Factory rule produced too many decisions.');
  }
  const decisions: FactoryCommitDecision[] = [];
  for (const value of values) {
    const decision = validateFactoryRuleDecision(value, causalDepth);
    if (decision.type === 'reject') {
      throw new FactoryRuleValidationError('A rejection cannot be persisted with commit decisions.');
    }
    decisions.push(decision);
  }
  const keys = decisions.map(decision => decision.idempotencyKey);
  if (new Set(keys).size !== keys.length) {
    throw new FactoryRuleValidationError('Factory decisions require unique idempotency keys.');
  }
  return decisions;
}
