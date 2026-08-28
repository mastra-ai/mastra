import type { KnowledgeConcreteRole, KnowledgeScope } from '../../storage/domains/knowledge';

/** @experimental Knowledge importer APIs are experimental and may change without notice. */
export type KnowledgeImporterKind = 'static' | 'agentic';

/** @experimental Knowledge importer APIs are experimental and may change without notice. */
export interface KnowledgeImporterSourceIdentity {
  readonly type: string;
  readonly id: string;
}

/** @experimental Knowledge importer APIs are experimental and may change without notice. */
export interface KnowledgeImporterTriggers {
  readonly cron?: string | readonly string[];
  readonly webhook?: true;
}

/** @experimental Knowledge importer APIs are experimental and may change without notice. */
export type KnowledgeImporterRole = Extract<KnowledgeConcreteRole, 'append' | 'edit' | 'owner'>;

/** @experimental Knowledge importer APIs are experimental and may change without notice. */
export interface KnowledgeImporterRegistrationContext {
  readonly importerId: string;
  readonly source: KnowledgeImporterSourceIdentity;
  readonly sourceKey: string;
  readonly kind: KnowledgeImporterKind;
  readonly scope: Readonly<KnowledgeScope>;
  readonly role: KnowledgeImporterRole;
  readonly triggers: KnowledgeImporterTriggers;
  readonly programmatic: true;
  readonly webhookPath?: (instanceKey: string) => string;
}

/** @experimental Knowledge importer APIs are experimental and may change without notice. */
export interface KnowledgeImporterDefinition {
  readonly id: string;
  readonly source: KnowledgeImporterSourceIdentity;
  readonly kind: KnowledgeImporterKind;
  readonly scope: Readonly<KnowledgeScope>;
  readonly role: KnowledgeImporterRole;
  readonly triggers?: KnowledgeImporterTriggers;
}

/** @experimental Knowledge importer APIs are experimental and may change without notice. */
export interface KnowledgeImporterHandle extends KnowledgeImporterRegistrationContext {
  readonly definition: KnowledgeImporterDefinition;
}
