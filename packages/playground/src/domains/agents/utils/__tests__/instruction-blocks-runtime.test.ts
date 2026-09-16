import { describe, it, expect } from 'vitest';

import {
  createInstructionBlock,
  createRefInstructionBlock,
} from '../../components/agent-edit-page/utils/form-validation';
import {
  formatUnknownPromptBlocksMessage,
  formatUnresolvedPromptBlocksMessage,
  instructionsResolveEmptyDueToDrafts,
} from '../instruction-blocks-runtime';

/** A publication map that marks the referenced IDs as unpublished. */
const allDrafts = new Map<string, 'published' | 'unpublished' | 'unknown'>([
  ['draft-a', 'unpublished'],
  ['draft-b', 'unpublished'],
]);

/**
 * A publication map that marks every queried ID as published.
 * Uses a Proxy to intercept get() and always return 'published'.
 */
const mapAllPublished = (): ReadonlyMap<string, 'published' | 'unpublished' | 'unknown'> => {
  const inner = new Map<string, 'published' | 'unpublished' | 'unknown'>();
  return new Proxy(inner, {
    get(target, prop) {
      if (prop === 'get') {
        return (_key: string) => 'published' as const;
      }
      return Reflect.get(target, prop);
    },
  });
};

/**
 * Build a publication map where the given IDs are published.
 * Missing keys return undefined (treated as unknown).
 */
const publishedIds = (...ids: string[]) => {
  const map = new Map<string, 'published' | 'unpublished' | 'unknown'>();
  for (const id of ids) {
    map.set(id, 'published');
  }
  return map;
};

describe('instructionsResolveEmptyDueToDrafts', () => {
  it('returns published for empty / undefined block lists', () => {
    expect(instructionsResolveEmptyDueToDrafts(undefined, allDrafts)).toEqual({ type: 'published' });
    expect(instructionsResolveEmptyDueToDrafts([], allDrafts)).toEqual({ type: 'published' });
  });

  it('returns published when an inline block has content (runtime keeps it)', () => {
    const blocks = [createInstructionBlock('You are a helpful assistant.')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toEqual({ type: 'published' });
  });

  it('returns published when there are no refs, only empty inline blocks', () => {
    const blocks = [createInstructionBlock('')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toEqual({ type: 'published' });
  });

  it('returns empty when every ref is unpublished and there is no inline content', () => {
    const blocks = [createRefInstructionBlock('draft-a'), createRefInstructionBlock('draft-b')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toEqual({ type: 'empty' });
  });

  it('returns published when at least one ref is published', () => {
    const blocks = [createRefInstructionBlock('draft-a'), createRefInstructionBlock('published-b')];
    const statuses = new Map(allDrafts);
    statuses.set('published-b', 'published');

    expect(instructionsResolveEmptyDueToDrafts(blocks, statuses)).toEqual({ type: 'published' });
  });

  it('returns published when an inline block accompanies draft refs', () => {
    const blocks = [createRefInstructionBlock('draft-a'), createInstructionBlock('Inline guidance.')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toEqual({ type: 'published' });
  });

  it('returns published when all refs are published', () => {
    const blocks = [createRefInstructionBlock('published-a')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, mapAllPublished())).toEqual({ type: 'published' });
  });

  it('ignores refs with an empty promptBlockId', () => {
    const blocks = [createRefInstructionBlock('')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toEqual({ type: 'published' });
  });

  describe('when a referenced block has unknown publication status', () => {
    it('treats a missing status entry as unknown', () => {
      const blocks = [createRefInstructionBlock('missing-status')];

      expect(instructionsResolveEmptyDueToDrafts(blocks, new Map())).toEqual({
        type: 'unknown',
        ids: ['missing-status'],
      });
    });

    it('returns the unknown block IDs when no published block or inline content exists', () => {
      const blocks = [createRefInstructionBlock('unknown-a'), createRefInstructionBlock('draft-b')];
      const statuses = new Map<string, 'published' | 'unpublished' | 'unknown'>([
        ['unknown-a', 'unknown'],
        ['draft-b', 'unpublished'],
      ]);

      expect(instructionsResolveEmptyDueToDrafts(blocks, statuses)).toEqual({
        type: 'unknown',
        ids: ['unknown-a'],
      });
    });

    it('returns unknown when another reference is known published', () => {
      const blocks = [createRefInstructionBlock('unknown-a'), createRefInstructionBlock('published-b')];
      const statuses = new Map<string, 'published' | 'unpublished' | 'unknown'>([
        ['unknown-a', 'unknown'],
        ['published-b', 'published'],
      ]);

      expect(instructionsResolveEmptyDueToDrafts(blocks, statuses)).toEqual({
        type: 'unknown',
        ids: ['unknown-a'],
      });
    });

    it('returns unknown when inline content accompanies an unknown ref', () => {
      const blocks = [createRefInstructionBlock('unknown-a'), createInstructionBlock('Inline guidance.')];

      expect(instructionsResolveEmptyDueToDrafts(blocks, new Map())).toEqual({
        type: 'unknown',
        ids: ['unknown-a'],
      });
    });
  });
});

describe('formatUnknownPromptBlocksMessage', () => {
  it('names one unknown block', () => {
    expect(formatUnknownPromptBlocksMessage(['block-1'])).toBe(
      'Unable to verify publication status for prompt block: block-1. The block may have been deleted or is temporarily unavailable. Please check and try again.',
    );
  });

  it('names multiple unknown blocks', () => {
    expect(formatUnknownPromptBlocksMessage(['block-1', 'block-2'])).toBe(
      'Unable to verify publication status for prompt blocks: block-1, block-2. The block may have been deleted or is temporarily unavailable. Please check and try again.',
    );
  });
});

describe('formatUnresolvedPromptBlocksMessage', () => {
  it('formats a single block with name', () => {
    const result = formatUnresolvedPromptBlocksMessage([{ id: 'block-1', name: 'My Block', reason: 'not_found' }]);
    expect(result).toBe(
      'Unable to verify referenced prompt block: "My Block" (block-1). Resolve these references or try again before continuing.',
    );
  });

  it('formats multiple blocks with mixed names', () => {
    const result = formatUnresolvedPromptBlocksMessage([
      { id: 'block-1', name: 'My Block', reason: 'not_found' },
      { id: 'block-2', reason: 'forbidden' },
    ]);
    expect(result).toBe(
      'Unable to verify referenced prompt blocks: "My Block" (block-1), block-2. Resolve these references or try again before continuing.',
    );
  });

  it('includes only IDs when no names are available', () => {
    const result = formatUnresolvedPromptBlocksMessage([{ id: 'block-1', reason: 'request_failed' }]);
    expect(result).toBe(
      'Unable to verify referenced prompt block: block-1. Resolve these references or try again before continuing.',
    );
  });
});
