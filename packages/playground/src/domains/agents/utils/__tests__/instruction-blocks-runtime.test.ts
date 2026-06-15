import { describe, it, expect } from 'vitest';

import {
  createInstructionBlock,
  createRefInstructionBlock,
} from '../../components/agent-edit-page/utils/form-validation';
import { instructionsResolveEmptyDueToDrafts } from '../instruction-blocks-runtime';

// Publication lookup helpers for the tests.
const allDrafts = () => false;
const allPublished = () => true;
const publishedIds = (...ids: string[]) => (id: string) => ids.includes(id);

describe('instructionsResolveEmptyDueToDrafts', () => {
  it('returns false for empty / undefined block lists', () => {
    expect(instructionsResolveEmptyDueToDrafts(undefined, allDrafts)).toBe(false);
    expect(instructionsResolveEmptyDueToDrafts([], allDrafts)).toBe(false);
  });

  it('returns false when an inline block has content (runtime keeps it)', () => {
    const blocks = [createInstructionBlock('You are a helpful assistant.')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toBe(false);
  });

  it('returns false when there are no refs, only empty inline blocks', () => {
    // The generic "instructions are required" validation already covers this.
    const blocks = [createInstructionBlock('')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toBe(false);
  });

  it('returns true when every ref is unpublished and there is no inline content', () => {
    const blocks = [createRefInstructionBlock('draft-a'), createRefInstructionBlock('draft-b')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toBe(true);
  });

  it('returns false when at least one ref is published', () => {
    const blocks = [createRefInstructionBlock('draft-a'), createRefInstructionBlock('published-b')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, publishedIds('published-b'))).toBe(false);
  });

  it('returns false when an inline block accompanies draft refs', () => {
    const blocks = [createRefInstructionBlock('draft-a'), createInstructionBlock('Inline guidance.')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toBe(false);
  });

  it('returns false when all refs are published', () => {
    const blocks = [createRefInstructionBlock('published-a')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allPublished)).toBe(false);
  });

  it('ignores refs with an empty promptBlockId', () => {
    const blocks = [createRefInstructionBlock('')];
    expect(instructionsResolveEmptyDueToDrafts(blocks, allDrafts)).toBe(false);
  });
});
