import { describe, expect, it } from 'vitest';

import {
  clearRemovable,
  collectIds,
  countLeaves,
  createGroup,
  denormalize,
  findGroup,
  flattenItems,
  groupDepth,
  insertItem,
  normalize,
  pruneEmptyGroups,
  removeNode,
  removeNodes,
  setGroupLogic,
  updateItem,
} from './filter-bar-tree';
import type { FilterBarExpression, FilterBarGroup, FilterBarItem, FilterBarNode } from './types';

const item = (id: string): FilterBarItem => ({ id, fieldId: 'status', operatorId: 'is', value: id });
const group = (id: string, ...nodes: FilterBarNode[]): FilterBarGroup => ({ id, kind: 'group', logic: 'or', nodes });

// a AND (b OR c OR (e OR f)) AND d
const expr: FilterBarExpression = {
  logic: 'and',
  nodes: [item('a'), group('g1', item('b'), item('c'), group('g2', item('e'), item('f'))), item('d')],
};

const g1 = (next: FilterBarExpression) => next.nodes[1] as FilterBarGroup;
const g2 = (next: FilterBarExpression) => g1(next).nodes[2] as FilterBarGroup;

describe('filter-bar-tree', () => {
  describe('when normalizing a flat array', () => {
    it('wraps it in a root and-expression', () => {
      expect(normalize([item('a')])).toEqual({ logic: 'and', nodes: [item('a')] });
    });

    it('denormalizes back to the same items', () => {
      expect(denormalize(normalize([item('a'), item('b')]), true)).toEqual([item('a'), item('b')]);
    });
  });

  describe('when flattening', () => {
    it('yields items in document order, tagged with their group', () => {
      expect(flattenItems(expr)).toEqual([
        { item: item('a') },
        { item: item('b'), groupId: 'g1' },
        { item: item('c'), groupId: 'g1' },
        { item: item('e'), groupId: 'g2' },
        { item: item('f'), groupId: 'g2' },
        { item: item('d') },
      ]);
    });
  });

  describe('when looking up groups', () => {
    it('finds nested groups', () => {
      expect(findGroup(expr, 'g2')?.nodes.map(n => n.id)).toEqual(['e', 'f']);
    });

    it('reports depth from 1 at the root, 0 when missing', () => {
      expect(groupDepth(expr, 'g1')).toBe(1);
      expect(groupDepth(expr, 'g2')).toBe(2);
      expect(groupDepth(expr, 'nope')).toBe(0);
    });

    it('counts leaves and collects ids recursively', () => {
      expect(countLeaves(g1(expr))).toBe(4);
      expect(collectIds(g1(expr))).toEqual(['g1', 'b', 'c', 'g2', 'e', 'f']);
    });
  });

  describe('when inserting', () => {
    it('appends to root when no group is given', () => {
      expect(insertItem(expr, undefined, item('x')).nodes.at(-1)).toEqual(item('x'));
    });

    it('appends inside a nested group', () => {
      expect(g2(insertItem(expr, 'g2', item('x'))).nodes.map(n => n.id)).toEqual(['e', 'f', 'x']);
    });
  });

  describe('when removing', () => {
    it('removes a root item', () => {
      expect(removeNode(expr, 'a').nodes.map(n => n.id)).toEqual(['g1', 'd']);
    });

    it('removes a nested item', () => {
      expect(g2(removeNode(expr, 'e')).nodes.map(n => n.id)).toEqual(['f']);
    });

    it('keeps a group that became empty', () => {
      const next = removeNodes(expr, ['e', 'f']);
      expect(g2(next).nodes).toEqual([]);
    });

    it('removes a whole nested group by id', () => {
      expect(g1(removeNode(expr, 'g2')).nodes.map(n => n.id)).toEqual(['b', 'c']);
    });
  });

  describe('when pruning', () => {
    it('drops empty groups bottom-up', () => {
      const next = pruneEmptyGroups(removeNodes(expr, ['b', 'c', 'e', 'f']));
      expect(next.nodes.map(n => n.id)).toEqual(['a', 'd']);
    });

    it('keeps groups that still have leaves', () => {
      const next = pruneEmptyGroups(removeNodes(expr, ['e', 'f']));
      expect(g1(next).nodes.map(n => n.id)).toEqual(['b', 'c']);
    });
  });

  describe('when updating an item', () => {
    it('patches nested items in place', () => {
      expect(g2(updateItem(expr, 'f', { value: 'zzz' })).nodes[1]).toEqual({ ...item('f'), value: 'zzz' });
    });
  });

  describe('when toggling logic', () => {
    it('sets root logic', () => {
      expect(setGroupLogic(expr, 'root', 'or').logic).toBe('or');
    });

    it('sets a nested group logic', () => {
      expect(g2(setGroupLogic(expr, 'g2', 'and')).logic).toBe('and');
    });
  });

  describe('when creating a group', () => {
    it('appends it to the root', () => {
      expect(createGroup(expr, undefined, group('g3')).nodes.at(-1)).toEqual(group('g3'));
    });

    it('appends it inside a parent group', () => {
      expect(g2(createGroup(expr, 'g2', group('g3'))).nodes.at(-1)).toEqual(group('g3'));
    });
  });

  describe('when clearing', () => {
    it('keeps pinned items at any depth and drops empty groups', () => {
      expect(clearRemovable(expr, new Set(['a', 'f'])).nodes).toEqual([item('a'), group('g1', group('g2', item('f')))]);
    });

    it('drops everything when nothing is pinned', () => {
      expect(clearRemovable(expr, new Set()).nodes).toEqual([]);
    });
  });
});
