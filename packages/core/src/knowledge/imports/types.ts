import type { KnowledgeConcreteRole, KnowledgeScopeIds } from '../../storage/domains/knowledge';

export type KnowledgeImporterKind = 'static' | 'agentic';

export interface KnowledgeImporterSourceIdentity {
  readonly type: string;
  readonly id: string;
}

export interface KnowledgeImporterTriggers {
  readonly cron?: string | readonly string[];
  readonly webhook?: true;
}

export type KnowledgeImporterRole = Extract<KnowledgeConcreteRole, 'append' | 'edit' | 'owner'>;

export interface KnowledgeImporterRegistrationContext {
  readonly importerId: string;
  readonly source: KnowledgeImporterSourceIdentity;
  readonly sourceKey: string;
  readonly kind: KnowledgeImporterKind;
  readonly scopeIds: Readonly<KnowledgeScopeIds>;
  readonly role: KnowledgeImporterRole;
  readonly triggers: KnowledgeImporterTriggers;
  readonly programmatic: true;
  readonly webhookPath?: (instanceKey: string) => string;
}

export interface KnowledgeImporterDefinition {
  readonly id: string;
  readonly source: KnowledgeImporterSourceIdentity;
  readonly kind: KnowledgeImporterKind;
  readonly scopeIds: Readonly<KnowledgeScopeIds>;
  readonly role: KnowledgeImporterRole;
  readonly triggers?: KnowledgeImporterTriggers;
}

export interface KnowledgeImporterHandle extends KnowledgeImporterRegistrationContext {
  readonly definition: KnowledgeImporterDefinition;
}
