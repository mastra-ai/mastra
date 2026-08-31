import { describe, expect, it } from 'vitest';

import {
  assertKnowledgeGrantRole,
  combineKnowledgeCapabilities,
  getKnowledgeRoleCapabilities,
  NO_KNOWLEDGE_CAPABILITIES,
  resolveKnowledgeGrantCapabilities,
} from '../grants';

describe('canonical Knowledge grant capabilities', () => {
  it('maps concrete roles to capability bundles', () => {
    expect(getKnowledgeRoleCapabilities('readonly')).toEqual({
      read: true,
      append: false,
      edit: false,
      delete: false,
      createChildren: false,
      manageAccess: false,
      suggest: false,
    });
    expect(getKnowledgeRoleCapabilities('append', true)).toMatchObject({
      read: true,
      append: true,
      edit: false,
      suggest: true,
    });
    expect(getKnowledgeRoleCapabilities('edit')).toMatchObject({
      append: true,
      edit: true,
      delete: false,
    });
    expect(getKnowledgeRoleCapabilities('owner')).toEqual({
      read: true,
      append: true,
      edit: true,
      delete: true,
      createChildren: true,
      manageAccess: true,
      suggest: false,
    });
  });

  it('composes the strongest concrete bundle independently from suggest', () => {
    const combined = combineKnowledgeCapabilities([
      getKnowledgeRoleCapabilities('append'),
      getKnowledgeRoleCapabilities('readonly', true),
    ]);

    expect(combined).toEqual({
      read: true,
      append: true,
      edit: false,
      delete: false,
      createChildren: false,
      manageAccess: false,
      suggest: true,
    });
  });

  it('derives mirror capabilities exactly and contributes nothing without a counterpart', () => {
    const counterpart = getKnowledgeRoleCapabilities('edit', true);

    expect(resolveKnowledgeGrantCapabilities({ role: 'mirror' }, counterpart)).toEqual(counterpart);
    expect(resolveKnowledgeGrantCapabilities({ role: 'mirror' })).toEqual(NO_KNOWLEDGE_CAPABILITIES);
    expect(resolveKnowledgeGrantCapabilities({ role: 'readonly', canSuggest: true }, counterpart)).toEqual(
      getKnowledgeRoleCapabilities('readonly', true),
    );
  });

  it('rejects roles outside the canonical grant vocabulary', () => {
    expect(() => assertKnowledgeGrantRole('full-edit')).toThrow('Invalid Knowledge grant role');
  });
});
