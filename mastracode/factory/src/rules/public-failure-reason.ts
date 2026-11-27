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
// A test fails when a new error class is neither listed here nor excluded in public-failure-reason.test.ts.
export const FACTORY_ERROR_NAMES: ReadonlySet<string> = new Set([
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
  'LinearGraphqlError',
  'LinearReauthRequiredError',
  'MastraGatewayError',
  'MaterializeError',
  'PlatformConnectionNotConnectedError',
  'PullRequestClosedError',
  'RealtimeSessionError',
  'ReviewBoardInUseError',
  'SessionBranchHeldError',
  'SessionOwnershipMismatchError',
  'SetupCommandError',
  'SkillInvocationError',
  'SlackSessionStartError',
  'SourceControlConnectionNotFoundError',
  'StoredBoardError',
  'UntrustedSharedSessionError',
  'WorkItemRelationError',
  'WorkItemRepositoryError',
  'WorkItemSourceConflictError',
  'WorkItemSplitModeError',
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

function ruleRejectionDetail(error: object): string | undefined {
  if (!(error instanceof FactoryRuleRejectedError)) return undefined;
  return Object.hasOwn(RULE_REJECTION_DETAIL, error.code) ? RULE_REJECTION_DETAIL[error.code] : undefined;
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
    first(chain, ruleRejectionDetail) ??
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
