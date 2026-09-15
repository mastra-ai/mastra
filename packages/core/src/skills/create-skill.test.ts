import { describe, it, expect } from 'vitest';

import { createSkill, isInlineSkill } from './create-skill';

describe('createSkill', () => {
  it('creates a valid inline skill with minimal input', () => {
    const skill = createSkill({
      name: 'test-skill',
      description: 'A test skill for unit testing.',
      instructions: 'Follow these instructions carefully.',
    });

    expect(skill.__inline).toBe(true);
    expect(skill.name).toBe('test-skill');
    expect(skill.description).toBe('A test skill for unit testing.');
    expect(skill.instructions).toBe('Follow these instructions carefully.');
    expect(skill.path).toBe('inline/test-skill');
    expect(skill.source).toEqual({ type: 'local', projectPath: 'inline/test-skill' });
    expect(skill.references).toEqual([]);
    expect(skill.scripts).toEqual([]);
    expect(skill.assets).toEqual([]);
    expect(skill.__referenceContents).toEqual({});
  });

  it('includes reference keys and contents', () => {
    const skill = createSkill({
      name: 'review-skill',
      description: 'Code review skill.',
      instructions: 'Review the code.',
      references: {
        'checklist.md': '# Review Checklist\n- Check correctness',
        'style.md': '# Style Guide\n- Use consistent naming',
      },
    });

    expect(skill.references).toEqual(['checklist.md', 'style.md']);
    expect(skill.__referenceContents).toEqual({
      'checklist.md': '# Review Checklist\n- Check correctness',
      'style.md': '# Style Guide\n- Use consistent naming',
    });
  });

  it('includes optional metadata fields', () => {
    const skill = createSkill({
      name: 'full-skill',
      description: 'A fully configured skill.',
      instructions: 'Instructions here.',
      license: 'MIT',
      compatibility: 'Node.js >= 18',
      'user-invocable': false,
      metadata: { category: 'testing', priority: 'high' },
    });

    expect(skill.license).toBe('MIT');
    expect(skill.compatibility).toBe('Node.js >= 18');
    expect(skill['user-invocable']).toBe(false);
    expect(skill.metadata).toEqual({ category: 'testing', priority: 'high' });
  });

  it('throws on invalid skill name', () => {
    expect(() =>
      createSkill({
        name: 'INVALID_NAME',
        description: 'Bad name.',
        instructions: 'Instructions.',
      }),
    ).toThrow('Invalid skill "INVALID_NAME"');
  });

  it('throws on empty description', () => {
    expect(() =>
      createSkill({
        name: 'test-skill',
        description: '',
        instructions: 'Instructions.',
      }),
    ).toThrow('Invalid skill "test-skill"');
  });

  it('throws on name with consecutive hyphens', () => {
    expect(() =>
      createSkill({
        name: 'bad--name',
        description: 'A test skill.',
        instructions: 'Instructions.',
      }),
    ).toThrow('Invalid skill "bad--name"');
  });
});

describe('isInlineSkill', () => {
  it('returns true for inline skills', () => {
    const skill = createSkill({
      name: 'test-skill',
      description: 'A test skill.',
      instructions: 'Instructions.',
    });
    expect(isInlineSkill(skill)).toBe(true);
  });

  it('returns false for plain objects', () => {
    expect(isInlineSkill({ name: 'foo' })).toBe(false);
    expect(isInlineSkill(null)).toBe(false);
    expect(isInlineSkill(undefined)).toBe(false);
    expect(isInlineSkill('string')).toBe(false);
  });

  it('returns false for objects with __inline !== true', () => {
    expect(isInlineSkill({ __inline: false })).toBe(false);
    expect(isInlineSkill({ __inline: 'true' })).toBe(false);
  });
});
