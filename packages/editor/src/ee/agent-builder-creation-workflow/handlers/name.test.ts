import { describe, it, expect } from 'vitest';
import { resolveName } from './name';

describe('resolveName', () => {
  it('uses the explicit name when provided', () => {
    expect(resolveName('a chatty support bot', 'Support Hero')).toBe('Support Hero');
  });

  it('trims the explicit name', () => {
    expect(resolveName('anything', '  Trimmed Name  ')).toBe('Trimmed Name');
  });

  it('falls back to the description when the explicit name is empty/whitespace', () => {
    expect(resolveName('research assistant agent', '   ')).toBe('Research Assistant Agent');
  });

  it('derives a Title Case name from the description', () => {
    expect(resolveName('customer support helper')).toBe('Customer Support Helper');
  });

  it('uses at most the first four words', () => {
    expect(resolveName('one two three four five six')).toBe('One Two Three Four');
  });

  it('strips punctuation and symbols before deriving', () => {
    expect(resolveName('e-mail triage & routing!')).toBe('E Mail Triage Routing');
  });

  it('handles unicode letters and numbers', () => {
    expect(resolveName('café 24 agent')).toBe('Café 24 Agent');
  });

  it('collapses repeated whitespace', () => {
    expect(resolveName('  spread   out   words  ')).toBe('Spread Out Words');
  });

  it('returns "New Agent" when the description has no usable words', () => {
    expect(resolveName('   !!! ---  ')).toBe('New Agent');
  });

  it('returns "New Agent" for an empty description and no name', () => {
    expect(resolveName('')).toBe('New Agent');
  });

  it('lowercases the tail of each word', () => {
    expect(resolveName('SHOUTING LOUD AGENT')).toBe('Shouting Loud Agent');
  });
});
