import { describe, it, expect } from 'vitest';

import { validateSkillContent, validateSkillMetadata } from './index';

const doc = (fm: string, body = 'Do the thing.') => `---\n${fm}\n---\n\n${body}\n`;

describe('validateSkillContent', () => {
  it('accepts valid content', () => {
    const result = validateSkillContent({ content: doc('name: foo\ndescription: Does foo'), directoryName: 'foo' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.metadata?.name).toBe('foo');
    expect(result.instructions).toBe('Do the thing.');
  });

  it('rejects a name that does not match the directory', () => {
    const result = validateSkillContent({ content: doc('name: bar\ndescription: Does bar'), directoryName: 'foo' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('"bar"') && e.includes('"foo"'))).toBe(true);
  });

  it('skips directory check when no directory is given', () => {
    expect(validateSkillContent({ content: doc('name: bar\ndescription: Does bar') }).valid).toBe(true);
  });

  it('rejects content without frontmatter', () => {
    expect(validateSkillContent({ content: '# just markdown' }).valid).toBe(false);
  });

  it('rejects missing description', () => {
    expect(validateSkillContent({ content: doc('name: foo'), directoryName: 'foo' }).valid).toBe(false);
  });

  it('returns an error instead of throwing on malformed YAML', () => {
    const result = validateSkillContent({ content: doc('name: [unclosed\ndescription: x'), directoryName: 'foo' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/^Invalid frontmatter:/);
  });

  it('returns warnings for very long bodies without failing', () => {
    const body = Array.from({ length: 600 }, (_, i) => `line ${i}`).join('\n');
    const result = validateSkillContent({
      content: doc('name: foo\ndescription: Does foo', body),
      directoryName: 'foo',
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('exports validateSkillMetadata', () => {
    expect(validateSkillMetadata({ metadata: { name: 'foo', description: 'x' }, directoryName: 'foo' }).valid).toBe(
      true,
    );
  });
});

describe('validateSkillContent metadata', () => {
  it('returns raw metadata even when invalid', () => {
    const result = validateSkillContent({ content: doc('name: 1\ndescription: x'), directoryName: 'foo' });
    expect(result.valid).toBe(false);
    expect(result.metadata?.name).toBe(1);
  });
});
