import type { KnowledgeConcreteRole, KnowledgeScopeGrant } from '../../storage/domains/knowledge';
import type { KnowledgeCapabilities } from './types';

const ROLE_CAPABILITIES: Record<KnowledgeConcreteRole, Omit<KnowledgeCapabilities, 'suggest'>> = {
  readonly: {
    read: true,
    append: false,
    edit: false,
    delete: false,
    createChildren: false,
    manageAccess: false,
  },
  append: {
    read: true,
    append: true,
    edit: false,
    delete: false,
    createChildren: false,
    manageAccess: false,
  },
  edit: {
    read: true,
    append: true,
    edit: true,
    delete: false,
    createChildren: false,
    manageAccess: false,
  },
  owner: {
    read: true,
    append: true,
    edit: true,
    delete: true,
    createChildren: true,
    manageAccess: true,
  },
};

export const NO_KNOWLEDGE_CAPABILITIES: Readonly<KnowledgeCapabilities> = Object.freeze({
  read: false,
  append: false,
  edit: false,
  delete: false,
  createChildren: false,
  manageAccess: false,
  suggest: false,
});

export function getKnowledgeRoleCapabilities(role: KnowledgeConcreteRole, canSuggest = false): KnowledgeCapabilities {
  return { ...ROLE_CAPABILITIES[role], suggest: canSuggest };
}

export function combineKnowledgeCapabilities(capabilities: readonly KnowledgeCapabilities[]): KnowledgeCapabilities {
  return capabilities.reduce<KnowledgeCapabilities>(
    (combined, current) => ({
      read: combined.read || current.read,
      append: combined.append || current.append,
      edit: combined.edit || current.edit,
      delete: combined.delete || current.delete,
      createChildren: combined.createChildren || current.createChildren,
      manageAccess: combined.manageAccess || current.manageAccess,
      suggest: combined.suggest || current.suggest,
    }),
    { ...NO_KNOWLEDGE_CAPABILITIES },
  );
}

export function resolveKnowledgeGrantCapabilities(
  grant: Pick<KnowledgeScopeGrant, 'role' | 'canSuggest'>,
  referencedCapabilities?: KnowledgeCapabilities,
): KnowledgeCapabilities {
  if (grant.role === 'mirror') {
    return referencedCapabilities ? { ...referencedCapabilities } : { ...NO_KNOWLEDGE_CAPABILITIES };
  }
  return getKnowledgeRoleCapabilities(grant.role, grant.canSuggest === true);
}

export function assertKnowledgeGrantRole(role: unknown): asserts role is KnowledgeScopeGrant['role'] {
  if (role !== 'readonly' && role !== 'append' && role !== 'edit' && role !== 'owner' && role !== 'mirror') {
    throw new Error(`Invalid Knowledge grant role: ${String(role)}`);
  }
}
