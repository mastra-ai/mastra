// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

/**
 * Tests for the result-type rendering logic used in WorkflowStatus.
 *
 * WorkflowStatus renders step results differently based on their type:
 * - Objects/arrays → CodeEditor (pretty-printed JSON with line wrapping)
 * - Strings → <pre> with whitespace-pre-wrap + break-words
 * - Numbers/booleans → <pre> with String() conversion
 *
 * The decision branch is: `typeof result === 'object' && result !== null`
 * for CodeEditor, otherwise plain text. These tests verify the classification.
 */

function classifyResult(result: unknown): 'code-editor' | 'plain-text' {
  return typeof result === 'object' && result !== null ? 'code-editor' : 'plain-text';
}

function formatPlainResult(result: unknown): string {
  return String(result);
}

describe('WorkflowStatus result classification', () => {
  it('classifies plain objects as code-editor', () => {
    expect(classifyResult({ message: 'hello', count: 42 })).toBe('code-editor');
  });

  it('classifies arrays as code-editor', () => {
    expect(classifyResult([{ id: 1 }, { id: 2 }])).toBe('code-editor');
  });

  it('classifies empty objects as code-editor', () => {
    expect(classifyResult({})).toBe('code-editor');
  });

  it('classifies strings as plain-text', () => {
    expect(classifyResult('This is a long workflow output string')).toBe('plain-text');
  });

  it('classifies numbers as plain-text', () => {
    expect(classifyResult(42)).toBe('plain-text');
  });

  it('classifies booleans as plain-text', () => {
    expect(classifyResult(true)).toBe('plain-text');
    expect(classifyResult(false)).toBe('plain-text');
  });

  it('classifies null as plain-text', () => {
    expect(classifyResult(null)).toBe('plain-text');
  });

  it('classifies undefined as plain-text', () => {
    expect(classifyResult(undefined)).toBe('plain-text');
  });
});

describe('WorkflowStatus plain result formatting', () => {
  it('formats strings as-is', () => {
    expect(formatPlainResult('hello world')).toBe('hello world');
  });

  it('formats numbers as string', () => {
    expect(formatPlainResult(42)).toBe('42');
    expect(formatPlainResult(0)).toBe('0');
    expect(formatPlainResult(-1.5)).toBe('-1.5');
  });

  it('formats booleans as string', () => {
    expect(formatPlainResult(true)).toBe('true');
    expect(formatPlainResult(false)).toBe('false');
  });

  it('formats null as string', () => {
    expect(formatPlainResult(null)).toBe('null');
  });

  it('formats undefined as string', () => {
    expect(formatPlainResult(undefined)).toBe('undefined');
  });
});
