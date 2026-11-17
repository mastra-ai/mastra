import { classifyProviderError, PROVIDER_CALL_ERROR_NAME } from '@mastra/core/error';
import type { ProviderFailureKind } from '@mastra/core/error';

import type { FactoryDispatchFailureCode } from '../storage/domains/work-items/base.js';
import { factoryDispatchFailureMetadata, FactoryRuleRejectedError } from './dispatch-errors.js';
import type { FactoryRuleRejectionCode } from './types.js';

export function causeOf(error: unknown): unknown {
  return error && typeof error === 'object' && 'cause' in error ? error.cause : undefined;
}

export function isProviderCallError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('name' in error && typeof error.name === 'string' && PROVIDER_CALL_ERROR_NAME.test(error.name)) return true;
  return 'statusCode' in error || 'responseBody' in error;
}

// Everything below is fixed wording or a name from Factory's public source:
// a public pull request must never see provider or internal error text.

const PROVIDER_FAILURE_DETAIL: Record<Exclude<ProviderFailureKind, 'unknown'>, string> = {
  auth: 'the model provider rejected the credentials',
  quota: 'the model provider quota is exhausted',
  rate_limited: 'the model provider rate-limited the run',
  context_overflow: 'the conversation exceeded the model context window',
  model_rejected: 'the model provider rejected the model',
  tool_history_rejected: 'the model provider rejected the tool-call history',
  timeout: 'the model provider timed out',
  unavailable: 'the model provider was unavailable',
  invalid_request: 'the model provider rejected the request',
};

const RULE_REJECTION_DETAIL: Record<FactoryRuleRejectionCode, string> = {
  forbidden: 'the board refused the move',
  invalid_transition: 'the board does not allow that move',
  missing_binding: 'the card has no run binding for that move',
  stale: 'the card changed while it was being moved',
  timeout: 'a board rule timed out',
  rule_error: 'a board rule threw an error',
  causal_depth_exceeded: 'too many automatic moves chained from one change',
  repeated_transition: 'the same automatic move repeated too often',
  approval_required: 'the move needs approval from a person',
  card_busy: 'a run is already in flight on the card',
};

// Node and undici system error codes: they name the fault, never the host or path.
const SYSTEM_ERROR_DETAIL: Record<string, string> = {
  ECONNREFUSED: 'a network connection was refused',
  ECONNRESET: 'a network connection was reset',
  ETIMEDOUT: 'a network connection timed out',
  ENOTFOUND: 'a host name could not be resolved',
  EAI_AGAIN: 'a host name could not be resolved',
  EHOSTUNREACH: 'a network host was unreachable',
  ENETUNREACH: 'the network was unreachable',
  EPIPE: 'a network connection closed while writing',
  UND_ERR_CONNECT_TIMEOUT: 'a network connection timed out',
  UND_ERR_HEADERS_TIMEOUT: 'a network response timed out',
  UND_ERR_BODY_TIMEOUT: 'a network response timed out',
  UND_ERR_SOCKET: 'a network connection was reset',
  ENOSPC: 'the disk is full',
  EMFILE: 'too many files were open',
  EACCES: 'a file permission was denied',
  EPERM: 'a file permission was denied',
  ENOENT: 'a required file was missing',
};

// Postgres SQLSTATE codes.
const DATABASE_ERROR_DETAIL: Record<string, string> = {
  '23505': 'a database unique constraint was violated',
  '23503': 'a database foreign key was violated',
  '40001': 'a database transaction conflicted with another',
  '40P01': 'a database deadlock occurred',
  '57014': 'a database statement timed out',
  '53300': 'the database has too many connections',
  '08000': 'the database connection was lost',
  '08003': 'the database connection was lost',
  '08006': 'the database connection was lost',
  '57P01': 'the database connection was lost',
};

// Built-in error names say what kind of fault it was without saying anything about where.
const BUILT_IN_ERROR_NAMES = new Set([
  'AbortError',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TimeoutError',
  'TypeError',
  'URIError',
]);

// Factory's own error classes say where it failed; the names are in its public source.
const FACTORY_ERROR_NAMES = new Set([
  'BoardDefinitionError',
  'BoardWriteError',
  'FactoryProjectNotFoundError',
  'FactoryRuleValidationError',
  'FactoryRunBindingSupersededError',
  'FactorySecretDecryptionError',
  'FactorySourceControlConflictError',
  'FactorySourceSessionResolutionError',
  'FactoryStartTransitionError',
  'GitLabApiError',
  'IncidentioApiError',
  'JiraApiError',
  'LinearReauthRequiredError',
  'MastraGatewayError',
  'MaterializeError',
  'PlatformApiError',
  'SessionBranchHeldError',
  'SessionOwnershipMismatchError',
  'SetupCommandError',
  'SkillInvocationError',
  'SourceControlConnectionNotFoundError',
  'StoredBoardError',
  'UntrustedSharedSessionError',
  'WorkItemRepositoryError',
  'WorkItemSourceConflictError',
  'WorkItemUpdateConflictError',
]);

const MAX_CAUSE_DEPTH = 8;

function causeChain(error: unknown): object[] {
  const chain: object[] = [];
  for (let current = error; current && chain.length < MAX_CAUSE_DEPTH; current = causeOf(current)) {
    if (typeof current !== 'object' || chain.includes(current)) break;
    chain.push(current);
  }
  return chain;
}

function field(error: object, key: string): unknown {
  return (error as Record<string, unknown>)[key];
}

/** The error's name, or its class name when it never set one; bundlers may suffix a renamed class with `$n`. */
function namesOf(error: object): string[] {
  const names: string[] = [];
  const name = field(error, 'name');
  if (typeof name === 'string') names.push(name);
  const constructorName = (error as { constructor?: { name?: unknown } }).constructor?.name;
  if (typeof constructorName === 'string') names.push(constructorName.replace(/\$\d+$/, ''));
  return names;
}

function providerDetail(error: object): string | undefined {
  if (!isProviderCallError(error)) return undefined;
  const kind = classifyProviderError(error);
  if (kind === 'unknown') return undefined;
  const status = field(error, 'statusCode');
  const http = typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 600;
  return http ? `${PROVIDER_FAILURE_DETAIL[kind]}, HTTP ${status}` : PROVIDER_FAILURE_DETAIL[kind];
}

function codedDetail(error: object): string | undefined {
  if (error instanceof FactoryRuleRejectedError) return RULE_REJECTION_DETAIL[error.code];
  const code = field(error, 'code');
  if (typeof code !== 'string') return undefined;
  if (Object.hasOwn(SYSTEM_ERROR_DETAIL, code)) return SYSTEM_ERROR_DETAIL[code];
  const fromDatabase = 'severity' in error || 'routine' in error;
  if (fromDatabase && Object.hasOwn(DATABASE_ERROR_DETAIL, code)) return DATABASE_ERROR_DETAIL[code];
  return undefined;
}

function first<T>(chain: object[], pick: (error: object) => T | undefined): T | undefined {
  for (const error of chain) {
    const picked = pick(error);
    if (picked !== undefined) return picked;
  }
  return undefined;
}

function publicDetail(error: unknown): string | undefined {
  const chain = causeChain(error);
  const where = first(chain, candidate => namesOf(candidate).find(name => FACTORY_ERROR_NAMES.has(name)));
  const what =
    first(chain, providerDetail) ??
    first(chain, codedDetail) ??
    first(chain, candidate => namesOf(candidate).find(name => BUILT_IN_ERROR_NAMES.has(name)));
  if (where && what) return `${where}: ${what}`;
  return where ?? what;
}

/**
 * Why a run failed, safe to show on a public pull request: the failure code's label,
 * plus a detail drawn from a fixed vocabulary when the error can be classified.
 * Error messages are never included; operators read those from the decision's stored error.
 */
export function publicFailureReason(code: FactoryDispatchFailureCode, error: unknown): string {
  const label = factoryDispatchFailureMetadata(code).label;
  const detail = publicDetail(error);
  return detail ? `${label} (${detail})` : label;
}
