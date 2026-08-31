import { describe, expect, it } from 'vitest';

import type { KnowledgeScopeGrant } from '../../../storage/domains/knowledge';
import { evaluateKnowledgeAccessFrontier } from '../evaluator';
import type { KnowledgeCapabilities } from '../types';

const READ = 1;
const APPEND = 2;
const EDIT = 4;
const DELETE = 8;
const CREATE_CHILDREN = 16;
const MANAGE_ACCESS = 32;
const SUGGEST = 64;
const ROLE_MASKS = {
  readonly: READ,
  append: READ | APPEND,
  edit: READ | APPEND | EDIT,
  owner: READ | APPEND | EDIT | DELETE | CREATE_CHILDREN | MANAGE_ACCESS,
} as const;

function scopeId(index: number): string {
  return `10000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
}

function capabilityMask(capabilities: Readonly<KnowledgeCapabilities>): number {
  return (
    (capabilities.read ? READ : 0) |
    (capabilities.append ? APPEND : 0) |
    (capabilities.edit ? EDIT : 0) |
    (capabilities.delete ? DELETE : 0) |
    (capabilities.createChildren ? CREATE_CHILDREN : 0) |
    (capabilities.manageAccess ? MANAGE_ACCESS : 0) |
    (capabilities.suggest ? SUGGEST : 0)
  );
}

function referenceFrontier(vouchedScopeIds: string[], grants: KnowledgeScopeGrant[]): Map<string, number> {
  const frontier = new Map(vouchedScopeIds.map(id => [id, READ]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const grant of grants) {
      const referenced = frontier.get(grant.scopeRefId);
      if (referenced === undefined) continue;
      const granted = grant.role === 'mirror' ? referenced : ROLE_MASKS[grant.role] | (grant.canSuggest ? SUGGEST : 0);
      const combined = (frontier.get(grant.scopeNodeId) ?? 0) | granted;
      if (combined === frontier.get(grant.scopeNodeId)) continue;
      frontier.set(grant.scopeNodeId, combined);
      changed = true;
    }
  }
  return frontier;
}

describe('Knowledge access frontier generated graphs', () => {
  it('matches a repeated-scan reference evaluator across cyclic multi-path graphs', () => {
    let state = 0x5eed1234;
    const random = (max: number) => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state % max;
    };
    const roles: KnowledgeScopeGrant['role'][] = ['readonly', 'append', 'edit', 'owner', 'mirror'];

    for (let example = 0; example < 100; example += 1) {
      const ids = Array.from({ length: 8 }, (_, index) => scopeId(index + 1));
      const grants = Array.from({ length: 20 }, () => {
        const role = roles[random(roles.length)]!;
        return {
          scopeNodeId: ids[random(ids.length)]!,
          scopeRefId: ids[random(ids.length)]!,
          role,
          canSuggest: role === 'mirror' ? undefined : random(4) === 0,
        } satisfies KnowledgeScopeGrant;
      });
      const vouchedScopeIds = [ids[random(ids.length)]!, ids[random(ids.length)]!];
      const expected = referenceFrontier(vouchedScopeIds, grants);
      const actual = evaluateKnowledgeAccessFrontier({ vouchedScopeIds, grants, accessEpoch: example });

      expect(Object.keys(actual.scopes).sort()).toEqual([...expected.keys()].sort());
      for (const [id, mask] of expected) {
        expect(capabilityMask(actual.scopes[id]!)).toBe(mask);
      }
    }
  });
});
