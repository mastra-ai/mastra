import { describe, expect, it } from 'vitest';

import { isEditorEffectivelyReadOnly, isInstructionsLocked, isToolsLocked } from '../agent-edit-form-context';

describe('isInstructionsLocked', () => {
  it('locks when a code agent disables the whole editor', () => {
    expect(isInstructionsLocked(true, false)).toBe(true);
  });

  it('locks when a code agent disowns instructions', () => {
    expect(isInstructionsLocked(true, { instructions: false, tools: false })).toBe(true);
  });

  it('does not lock when the code agent owns instructions', () => {
    expect(isInstructionsLocked(true, { instructions: true, tools: false })).toBe(false);
  });

  it('does not lock when the config omits instructions', () => {
    expect(isInstructionsLocked(true, { tools: true })).toBe(false);
    expect(isInstructionsLocked(true, undefined)).toBe(false);
  });

  it('never locks for a non-code agent', () => {
    expect(isInstructionsLocked(false, false)).toBe(false);
    expect(isInstructionsLocked(false, { instructions: false })).toBe(false);
    expect(isInstructionsLocked(undefined, { instructions: false })).toBe(false);
  });
});

describe('isToolsLocked', () => {
  it('locks when a code agent disables the editor or disowns tools', () => {
    expect(isToolsLocked(true, false)).toBe(true);
    expect(isToolsLocked(true, { tools: false })).toBe(true);
  });

  it('does not lock when tools are owned, descriptions-only, or omitted', () => {
    expect(isToolsLocked(true, { tools: true })).toBe(false);
    expect(isToolsLocked(true, { tools: { description: true } })).toBe(false);
    expect(isToolsLocked(true, { instructions: false })).toBe(false);
  });

  it('never locks for a non-code agent', () => {
    expect(isToolsLocked(false, { tools: false })).toBe(false);
  });
});

describe('isEditorEffectivelyReadOnly', () => {
  it('is read-only only when both instructions and tools are locked', () => {
    expect(isEditorEffectivelyReadOnly(true, { instructions: false, tools: false })).toBe(true);
    expect(isEditorEffectivelyReadOnly(true, false)).toBe(true);
  });

  it('is not read-only when either surface remains editable', () => {
    expect(isEditorEffectivelyReadOnly(true, { instructions: false, tools: true })).toBe(false);
    expect(isEditorEffectivelyReadOnly(true, { instructions: true, tools: false })).toBe(false);
    expect(isEditorEffectivelyReadOnly(true, { tools: { description: true } })).toBe(false);
    expect(isEditorEffectivelyReadOnly(true, undefined)).toBe(false);
  });

  it('is never read-only for a non-code agent', () => {
    expect(isEditorEffectivelyReadOnly(false, { instructions: false, tools: false })).toBe(false);
  });
});
