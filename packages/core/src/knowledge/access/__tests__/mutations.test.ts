import { describe, expect, it } from 'vitest';

import {
  assertKnowledgeScopeCapabilities,
  assertKnowledgeTargetCapability,
  getKnowledgeMutationCapabilities,
} from '../mutations';
import type { KnowledgeAccessFrontier, KnowledgeCapabilities } from '../types';

const scopeA = '10000000-0000-4000-8000-000000000001';
const scopeB = '10000000-0000-4000-8000-000000000002';
const hiddenScope = '10000000-0000-4000-8000-000000000003';

function capabilities(overrides: Partial<KnowledgeCapabilities>): KnowledgeCapabilities {
  return {
    read: false,
    append: false,
    edit: false,
    delete: false,
    createChildren: false,
    manageAccess: false,
    suggest: false,
    ...overrides,
  };
}

function frontier(scopes: KnowledgeAccessFrontier['scopes']): KnowledgeAccessFrontier {
  return { accessEpoch: 7, vouchedScopeIds: [scopeA], scopes };
}

describe('Knowledge mutation authorization', () => {
  it('combines direct capabilities across a target memberships without treating suggest as write authority', () => {
    const access = frontier({
      [scopeA]: capabilities({ read: true, append: true }),
      [scopeB]: capabilities({ read: true, suggest: true }),
    });

    expect(getKnowledgeMutationCapabilities(access, [scopeA, scopeB])).toEqual(
      capabilities({ read: true, append: true, suggest: true }),
    );
    expect(() =>
      assertKnowledgeTargetCapability({
        frontier: access,
        scopeIds: [scopeB],
        capability: 'edit',
        targetType: 'node',
        targetId: 'target',
      }),
    ).toThrow('Knowledge node not found: target');
  });

  it('accepts a point mutation when any direct membership grants the required capability', () => {
    const access = frontier({
      [scopeA]: capabilities({ read: true }),
      [scopeB]: capabilities({ read: true, edit: true }),
    });

    expect(() =>
      assertKnowledgeTargetCapability({
        frontier: access,
        scopeIds: [scopeA, scopeB],
        capability: 'edit',
        targetType: 'node',
        targetId: 'target',
      }),
    ).not.toThrow();
  });

  it('requires the capability on every explicitly selected structural scope', () => {
    const access = frontier({
      [scopeA]: capabilities({ read: true, delete: true }),
      [scopeB]: capabilities({ read: true }),
    });

    expect(() =>
      assertKnowledgeScopeCapabilities({
        frontier: access,
        scopeIds: [scopeA, scopeB],
        capability: 'delete',
        targetType: 'scope',
      }),
    ).toThrow(`Knowledge scope not found: ${scopeB}`);
    expect(() =>
      assertKnowledgeScopeCapabilities({
        frontier: access,
        scopeIds: [scopeA],
        capability: 'delete',
        targetType: 'scope',
      }),
    ).not.toThrow();
  });

  it('fails closed for an empty or inaccessible target without revealing which condition applied', () => {
    const access = frontier({ [scopeA]: capabilities({ read: true, edit: true }) });
    for (const scopeIds of [[], [hiddenScope]]) {
      expect(() =>
        assertKnowledgeTargetCapability({
          frontier: access,
          scopeIds,
          capability: 'edit',
          targetType: 'record',
          targetId: 'record-1',
        }),
      ).toThrow('Knowledge record not found: record-1');
    }
  });
});
