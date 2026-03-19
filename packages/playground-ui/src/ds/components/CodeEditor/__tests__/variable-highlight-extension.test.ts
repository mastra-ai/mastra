import { describe, it, expect } from 'vitest';
import { VARIABLE_PATTERN } from '../variable-highlight-extension';

describe('VARIABLE_PATTERN', () => {
  const matchAll = (text: string): string[] => {
    const matches: string[] = [];
    let match: RegExpExecArray | null;
    const pattern = new RegExp(VARIABLE_PATTERN.source, VARIABLE_PATTERN.flags);
    while ((match = pattern.exec(text)) !== null) {
      matches.push(match[0]);
    }
    return matches;
  };

  it('should match simple variable names', () => {
    const text = '{{userName}}';
    expect(matchAll(text)).toEqual(['{{userName}}']);
  });

  it('should match variables starting with underscore', () => {
    const text = '{{_privateVar}}';
    expect(matchAll(text)).toEqual(['{{_privateVar}}']);
  });

  it('should match variables with numbers', () => {
    const text = '{{user1Name}}';
    expect(matchAll(text)).toEqual(['{{user1Name}}']);
  });

  it('should match multiple variables in text', () => {
    const text = 'Hello {{userName}}, welcome to {{companyName}}!';
    expect(matchAll(text)).toEqual(['{{userName}}', '{{companyName}}']);
  });

  it('should not match variables starting with numbers', () => {
    const text = '{{1invalid}}';
    expect(matchAll(text)).toEqual([]);
  });

  it('should not match empty braces', () => {
    const text = '{{}}';
    expect(matchAll(text)).toEqual([]);
  });

  it('should not match single braces', () => {
    const text = '{singleBrace}';
    expect(matchAll(text)).toEqual([]);
  });

  it('should not match variables with spaces', () => {
    const text = '{{user name}}';
    expect(matchAll(text)).toEqual([]);
  });

  it('should not match variables with special characters', () => {
    const text = '{{user-name}}';
    expect(matchAll(text)).toEqual([]);
  });

  it('should match in markdown context', () => {
    const text = `# Instructions

You are helping {{userName}} at {{companyName}}.

## Context
- Role: {{userRole}}
- Language: {{preferredLanguage}}`;

    expect(matchAll(text)).toEqual(['{{userName}}', '{{companyName}}', '{{userRole}}', '{{preferredLanguage}}']);
  });
});
