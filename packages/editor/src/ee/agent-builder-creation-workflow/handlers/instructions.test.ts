import { describe, it, expect } from 'vitest';
import { resolveInstructions } from './instructions';

describe('resolveInstructions', () => {
  it('returns explicit instructions verbatim when provided', () => {
    expect(resolveInstructions('Name', 'desc', 'Do exactly this.')).toBe('Do exactly this.');
  });

  it('returns an explicit empty string verbatim (does not fall back)', () => {
    expect(resolveInstructions('Name', 'desc', '')).toBe('');
  });

  it('generates a default prompt from name and description when no explicit value', () => {
    const result = resolveInstructions('Support Hero', 'helps customers');
    expect(result).toContain('You are Support Hero.');
    expect(result).toContain('helps customers');
    expect(result).toContain('Make reasonable assumptions');
  });

  it('falls back when explicitInstructions is undefined', () => {
    expect(resolveInstructions('Bot', 'does things', undefined)).toContain('You are Bot.');
  });

  it('embeds name and description in the expected structure', () => {
    expect(resolveInstructions('Agent X', 'a description')).toBe(
      'You are Agent X.\n\na description\n\nHelp the user accomplish this outcome. Make reasonable assumptions and avoid asking unnecessary follow-up questions.',
    );
  });
});
