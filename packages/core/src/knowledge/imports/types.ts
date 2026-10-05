import type { Agent } from '../../agent';
import type { RequestContext } from '../../request-context';
import type { KnowledgeConcreteRole, KnowledgeImportRun, KnowledgeScopeIds } from '../../storage/domains/knowledge';
import type { Knowledge } from '../index';
import type { StaticKnowledgeImporterOperations, StaticKnowledgeRecordInput } from './static-importer';

export interface KnowledgeImporterBindingInput {
  readonly source: string;
  readonly scope: string;
}

export interface KnowledgeImporterCronTrigger {
  readonly schedule: string | readonly string[];
  readonly bindings: readonly KnowledgeImporterBindingInput[];
}

export interface KnowledgeImporterWebhookBindingContext {
  readonly payload: unknown;
  readonly request?: Request;
  readonly requestContext: RequestContext;
}

export interface KnowledgeImporterWebhookTrigger {
  readonly bindings: readonly KnowledgeImporterBindingInput[];
  readonly resolveBinding?: (
    context: KnowledgeImporterWebhookBindingContext,
  ) => KnowledgeImporterBindingInput | Promise<KnowledgeImporterBindingInput>;
}

export interface KnowledgeImporterTriggers {
  readonly cron?: KnowledgeImporterCronTrigger;
  readonly webhook?: KnowledgeImporterWebhookTrigger;
}

export type KnowledgeImporterRole = KnowledgeConcreteRole;
export type KnowledgeImporterAccess = Readonly<Record<string, KnowledgeImporterRole>>;

export interface KnowledgeImporterState {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export interface KnowledgeImporterAgentConfig {
  readonly agent: Agent;
  readonly maxSteps?: number;
}

export interface KnowledgeAgentImportInput {
  readonly instructions: string;
  readonly data: unknown;
  readonly checkpoint: string;
}

export interface KnowledgeAgentImportResult {
  readonly checkpoint: string;
  readonly resourceId: string;
  readonly transcriptThreadId: string;
  readonly text: string;
}

/** A source-qualified identity: importer addresses are unique only together with their source. */
export interface KnowledgeCitationRef {
  readonly source: string;
  readonly address: string;
}

/** Finite host policy shared by every citation hop in one run. */
export interface KnowledgeCitationBudget {
  readonly maxDepth: number;
  readonly maxItems: number;
  readonly timeoutMs: number;
}

export interface KnowledgeCitationEntity {
  readonly name: string;
  readonly metadata?: Record<string, unknown>;
  readonly records?: readonly StaticKnowledgeRecordInput[];
  /** Further citations this entity requires; expanded within the same shared budget. */
  readonly citations?: readonly KnowledgeCitationRef[];
}

/**
 * Registration-owned citation resolution. Only the binding's own source is fetched; citations into
 * other sources resolve only through bindings their owning registrations already committed.
 */
export interface KnowledgeImporterCitationPolicy {
  readonly budget: KnowledgeCitationBudget;
  fetch(input: {
    readonly address: string;
    readonly signal: AbortSignal;
  }): Promise<KnowledgeCitationEntity | undefined>;
}

/** Sanitized reasons; `unavailable` covers denied, hidden, deleted and absent alike. */
export type KnowledgeCitationUnresolvedReason = 'unavailable' | 'cycle' | 'depth' | 'items' | 'deadline' | 'error';

export interface KnowledgeCitationResolution {
  readonly resolved: ReadonlyArray<{ readonly ref: KnowledgeCitationRef; readonly nodeId: string }>;
  readonly unresolved: ReadonlyArray<{
    readonly ref: KnowledgeCitationRef;
    readonly reason: KnowledgeCitationUnresolvedReason;
  }>;
  /** False when any required citation reached in this call stayed unresolved. */
  readonly complete: boolean;
}

export interface KnowledgeImporterHandlerContext<TPayload = unknown> {
  readonly knowledge: Knowledge;
  readonly payload: TPayload | undefined;
  readonly run: KnowledgeImportRun;
  readonly signal: AbortSignal;
  readonly state: KnowledgeImporterState;
  importer(): Promise<StaticKnowledgeImporterOperations>;
  agentImport?(input: KnowledgeAgentImportInput): Promise<KnowledgeAgentImportResult>;
  /**
   * Resolves required citations under the registration's citation policy. A run that leaves any
   * required citation unresolved fails without committing state, so its cursor never advances.
   */
  resolveCitations?(refs: readonly KnowledgeCitationRef[]): Promise<KnowledgeCitationResolution>;
}

export type KnowledgeImporterHandler<TPayload = unknown> = (
  context: KnowledgeImporterHandlerContext<TPayload>,
) => void | Promise<void>;

export interface KnowledgeImporterDefinition<TPayload = unknown> {
  readonly id: string;
  readonly access?: KnowledgeImporterAccess;
  readonly canCreateRoots?: boolean;
  readonly triggers?: KnowledgeImporterTriggers;
  readonly agentic?: KnowledgeImporterAgentConfig;
  readonly citations?: KnowledgeImporterCitationPolicy;
  readonly handler: KnowledgeImporterHandler<TPayload>;
}

export interface KnowledgeImporterRegistrationContext<TPayload = unknown> {
  readonly importerId: string;
  readonly access?: KnowledgeImporterAccess;
  readonly canCreateRoots: boolean;
  readonly triggers: KnowledgeImporterTriggers;
  readonly agentic?: KnowledgeImporterAgentConfig;
  readonly citations?: KnowledgeImporterCitationPolicy;
  readonly handler: KnowledgeImporterHandler<TPayload>;
  readonly programmatic: true;
  readonly webhookPath?: (instanceKey: string) => string;
}

export interface KnowledgeImporterHandle<TPayload = unknown> extends KnowledgeImporterRegistrationContext<TPayload> {
  readonly definition: KnowledgeImporterDefinition<TPayload>;
  run(binding: KnowledgeImporterBindingInput, payload?: TPayload): Promise<KnowledgeImportRun>;
}

/** Runtime-only authority bound by a registered handler invocation. */
export interface KnowledgeImporterBindingHandle {
  readonly importerId: string;
  readonly binding: string;
  readonly source: string;
  readonly scopeAddress: string;
  readonly scopeId: string;
  readonly resolutionScopeIds: Readonly<KnowledgeScopeIds>;
  readonly role: Extract<KnowledgeImporterRole, 'append' | 'edit' | 'owner'>;
}
