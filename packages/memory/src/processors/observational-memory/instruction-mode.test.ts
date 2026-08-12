import { describe, expect, it } from 'vitest';

import {
  OBSERVER_EXTRACTION_INSTRUCTIONS,
  buildObserverSystemPrompt,
  resolveEffectiveObserverInstructions,
  resolveExtractionInstructions,
} from './observer-agent';
import { REFLECTOR_CONSOLIDATION_INSTRUCTIONS, buildReflectorSystemPrompt } from './reflector-agent';

const CUSTOM = 'Track entity IDs and the lifecycle state of every tool result.';

// A distinctive line from the built-in extraction guidance, used to assert whether the
// defaults are present without pinning the whole block into the test.
const DEFAULT_EXTRACTION_MARKER = 'CRITICAL: DISTINGUISH USER ASSERTIONS FROM QUESTIONS';
// A distinctive line from the built-in consolidation guidance.
const DEFAULT_CONSOLIDATION_MARKER = 'CRITICAL: USER ASSERTIONS vs QUESTIONS';
// From OBSERVER_GUIDELINES — part of the output contract OM retains in both modes.
const GUIDELINES_MARKER = 'Be specific enough for the assistant to act on';

describe('resolveExtractionInstructions', () => {
  it('returns the built-in instructions when no instruction is provided', () => {
    expect(resolveExtractionInstructions(undefined)).toBe(OBSERVER_EXTRACTION_INSTRUCTIONS);
    expect(resolveExtractionInstructions(undefined, 'replace')).toBe(OBSERVER_EXTRACTION_INSTRUCTIONS);
  });

  it('returns the built-in instructions in append mode', () => {
    expect(resolveExtractionInstructions(CUSTOM, 'append')).toBe(OBSERVER_EXTRACTION_INSTRUCTIONS);
  });

  it('returns the caller instruction in replace mode', () => {
    expect(resolveExtractionInstructions(CUSTOM, 'replace')).toBe(CUSTOM);
  });
});

describe('resolveEffectiveObserverInstructions', () => {
  it('combines the built-in guidance with the custom instruction in append mode', () => {
    const effective = resolveEffectiveObserverInstructions(CUSTOM, 'append');

    expect(effective).toContain(DEFAULT_EXTRACTION_MARKER);
    expect(effective).toContain('=== CUSTOM INSTRUCTIONS ===');
    expect(effective).toContain(CUSTOM);
  });

  it('returns only the caller instruction in replace mode', () => {
    const effective = resolveEffectiveObserverInstructions(CUSTOM, 'replace');

    expect(effective).toBe(CUSTOM);
    expect(effective).not.toContain(DEFAULT_EXTRACTION_MARKER);
  });

  it('returns the built-in guidance when no instruction is configured', () => {
    expect(resolveEffectiveObserverInstructions(undefined)).toBe(OBSERVER_EXTRACTION_INSTRUCTIONS);
  });

  // The Observer prompt interleaves the output format and guidelines between the extraction
  // block and the custom-instruction suffix, so the effective guidance is not one contiguous
  // slice of it — but every part of it must be present.
  it('covers the guidance the observer prompt actually carries', () => {
    for (const mode of ['append', 'replace'] as const) {
      const prompt = buildObserverSystemPrompt(false, CUSTOM, false, undefined, mode);
      const effective = resolveEffectiveObserverInstructions(CUSTOM, mode);

      expect(prompt).toContain(resolveExtractionInstructions(CUSTOM, mode));
      expect(effective).toContain(resolveExtractionInstructions(CUSTOM, mode));
      expect(effective).toContain(CUSTOM);
      expect(prompt).toContain(CUSTOM);
    }
  });
});

describe('buildObserverSystemPrompt instructionMode', () => {
  it('appends by default, keeping the built-in extraction guidance', () => {
    const prompt = buildObserverSystemPrompt(false, CUSTOM);

    expect(prompt).toContain(DEFAULT_EXTRACTION_MARKER);
    expect(prompt).toContain('=== CUSTOM INSTRUCTIONS ===');
    expect(prompt).toContain(CUSTOM);
  });

  it('replaces the built-in extraction guidance in replace mode', () => {
    const prompt = buildObserverSystemPrompt(false, CUSTOM, false, [], 'replace');

    expect(prompt).toContain(CUSTOM);
    expect(prompt).not.toContain(DEFAULT_EXTRACTION_MARKER);
    expect(prompt).not.toContain('=== CUSTOM INSTRUCTIONS ===');
  });

  it('retains the output format and guidelines in replace mode', () => {
    const prompt = buildObserverSystemPrompt(false, CUSTOM, false, [], 'replace');

    expect(prompt).toContain('<observations>');
    expect(prompt).toContain('=== OUTPUT FORMAT ===');
    expect(prompt).toContain(GUIDELINES_MARKER);
  });

  it('falls back to the built-in guidance when replace mode has no instruction', () => {
    const prompt = buildObserverSystemPrompt(false, undefined, false, [], 'replace');

    expect(prompt).toContain(DEFAULT_EXTRACTION_MARKER);
  });

  it('supports replace mode on the multi-thread prompt', () => {
    const prompt = buildObserverSystemPrompt(true, CUSTOM, false, [], 'replace');

    expect(prompt).toContain(CUSTOM);
    expect(prompt).toContain('=== MULTI-THREAD INPUT ===');
    expect(prompt).not.toContain(DEFAULT_EXTRACTION_MARKER);
  });

  it('leaves the default prompt unchanged when no instruction is given', () => {
    expect(buildObserverSystemPrompt(false, undefined, false, undefined, 'replace')).toBe(buildObserverSystemPrompt());
  });
});

describe('buildReflectorSystemPrompt instructionMode', () => {
  it('appends by default, keeping the built-in consolidation guidance', () => {
    const prompt = buildReflectorSystemPrompt(CUSTOM);

    expect(prompt).toContain(DEFAULT_CONSOLIDATION_MARKER);
    expect(prompt).toContain('=== CUSTOM INSTRUCTIONS ===');
    expect(prompt).toContain(CUSTOM);
  });

  it('replaces the built-in consolidation guidance in replace mode', () => {
    const prompt = buildReflectorSystemPrompt(CUSTOM, [], 'replace');

    expect(prompt).toContain(CUSTOM);
    expect(prompt).not.toContain(REFLECTOR_CONSOLIDATION_INSTRUCTIONS);
    expect(prompt).not.toContain('=== CUSTOM INSTRUCTIONS ===');
  });

  it('describes the observer guidance that is actually in effect', () => {
    const observerInstructions = resolveExtractionInstructions(CUSTOM, 'replace');
    const prompt = buildReflectorSystemPrompt(undefined, [], 'append', observerInstructions);

    expect(prompt).toContain('<observational-memory-instruction>');
    expect(prompt).toContain(CUSTOM);
    expect(prompt).not.toContain(DEFAULT_EXTRACTION_MARKER);
  });

  it('defaults to the built-in observer guidance when none is supplied', () => {
    expect(buildReflectorSystemPrompt()).toContain(DEFAULT_EXTRACTION_MARKER);
  });
});
