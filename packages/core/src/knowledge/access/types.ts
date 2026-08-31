import type { KnowledgeConcreteRole } from '../../storage/domains/knowledge';

export type KnowledgeCapability = 'read' | 'append' | 'edit' | 'delete' | 'createChildren' | 'manageAccess' | 'suggest';

export interface KnowledgeCapabilities {
  read: boolean;
  append: boolean;
  edit: boolean;
  delete: boolean;
  createChildren: boolean;
  manageAccess: boolean;
  suggest: boolean;
}

export interface KnowledgeConcreteGrantCapabilities {
  role: KnowledgeConcreteRole;
  canSuggest?: boolean;
}

export interface KnowledgeScopeAccess {
  scopeId: string;
  capabilities: Readonly<KnowledgeCapabilities>;
}

export interface KnowledgeAccessFrontier {
  accessEpoch: number;
  vouchedScopeIds: readonly string[];
  scopes: Readonly<Record<string, Readonly<KnowledgeCapabilities>>>;
}
