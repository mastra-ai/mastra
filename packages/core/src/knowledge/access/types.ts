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
