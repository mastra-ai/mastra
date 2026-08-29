import type { KnowledgeConcreteRole, KnowledgeScopeIds } from '../../storage/domains/knowledge';
import type { Knowledge } from '../index';
import type { StaticKnowledgeImporterOperations } from './static-importer';

export interface KnowledgeImporterTriggers {
  readonly cron?: string | readonly string[];
  readonly webhook?: true;
}

export type KnowledgeImporterRole = KnowledgeConcreteRole;
export type KnowledgeImporterAccess = Readonly<Record<string, KnowledgeImporterRole>>;

export interface KnowledgeImporterState {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export interface KnowledgeImporterBindingInput {
  readonly source: string;
  readonly scope: string;
}

export interface KnowledgeImporterHandlerContext<TPayload = unknown> {
  readonly knowledge: Knowledge;
  readonly payload: TPayload | undefined;
  readonly state: KnowledgeImporterState;
  importer(input: KnowledgeImporterBindingInput): Promise<StaticKnowledgeImporterOperations>;
}

export type KnowledgeImporterHandler<TPayload = unknown> = (
  context: KnowledgeImporterHandlerContext<TPayload>,
) => void | Promise<void>;

export interface KnowledgeImporterDefinition<TPayload = unknown> {
  readonly id: string;
  readonly access?: KnowledgeImporterAccess;
  readonly canCreateRoots?: boolean;
  readonly triggers?: KnowledgeImporterTriggers;
  readonly handler: KnowledgeImporterHandler<TPayload>;
}

export interface KnowledgeImporterRegistrationContext<TPayload = unknown> {
  readonly importerId: string;
  readonly access?: KnowledgeImporterAccess;
  readonly canCreateRoots: boolean;
  readonly triggers: KnowledgeImporterTriggers;
  readonly handler: KnowledgeImporterHandler<TPayload>;
  readonly programmatic: true;
  readonly webhookPath?: (instanceKey: string) => string;
}

export interface KnowledgeImporterHandle<TPayload = unknown> extends KnowledgeImporterRegistrationContext<TPayload> {
  readonly definition: KnowledgeImporterDefinition<TPayload>;
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
