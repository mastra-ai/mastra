import type { Agent } from '../../agent';
import type { RequestContext } from '../../request-context';
import type { KnowledgeConcreteRole, KnowledgeImportRun, KnowledgeScopeIds } from '../../storage/domains/knowledge';
import type { Knowledge } from '../index';
import type { StaticKnowledgeImporterOperations } from './static-importer';

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

export interface KnowledgeImporterHandlerContext<TPayload = unknown> {
  readonly knowledge: Knowledge;
  readonly payload: TPayload | undefined;
  readonly run: KnowledgeImportRun;
  readonly signal: AbortSignal;
  readonly state: KnowledgeImporterState;
  importer(): Promise<StaticKnowledgeImporterOperations>;
  agentImport?(input: KnowledgeAgentImportInput): Promise<KnowledgeAgentImportResult>;
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
  readonly handler: KnowledgeImporterHandler<TPayload>;
}

export interface KnowledgeImporterRegistrationContext<TPayload = unknown> {
  readonly importerId: string;
  readonly access?: KnowledgeImporterAccess;
  readonly canCreateRoots: boolean;
  readonly triggers: KnowledgeImporterTriggers;
  readonly agentic?: KnowledgeImporterAgentConfig;
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
