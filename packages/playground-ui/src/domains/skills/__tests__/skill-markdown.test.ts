import { describe, expect, it } from 'vitest';
import { findSkillFile, parseSkillMarkdown } from '../skill-markdown';

describe('parseSkillMarkdown', () => {
  it('reads the name and description from frontmatter and the rest as instructions', () => {
    const result = parseSkillMarkdown(
      '---\nname: deal-summaries\ndescription: "Use when someone asks about a deal"\n---\n\nAnswer as a short table.\n',
    );

    expect(result.skill).toEqual({
      name: 'deal-summaries',
      description: 'Use when someone asks about a deal',
      instructions: 'Answer as a short table.',
    });
  });

  it.each([
    ['folded', 'description: >-\n  Use when someone\n  asks about a deal', 'Use when someone asks about a deal'],
    ['literal', 'description: |\n  Use when asked.\n  Answer as a table.', 'Use when asked.\nAnswer as a table.'],
    ['continued', 'description: Use when someone\n  asks about a deal', 'Use when someone asks about a deal'],
  ])('reads a %s description over several lines', (_case, line, description) => {
    expect(parseSkillMarkdown(`---\nname: deal\n${line}\n---\nBody`).skill?.description).toBe(description);
  });

  it.each([
    ['no frontmatter', 'Answer as a short table.', 'SKILL.md has no frontmatter'],
    ['no name', '---\ndescription: x\n---\nBody', 'SKILL.md has no name'],
    ['no description', '---\nname: x\n---\nBody', 'SKILL.md has no description'],
    ['no instructions', '---\nname: x\ndescription: y\n---\n', 'SKILL.md has no instructions'],
  ])('says what is missing when the file has %s', (_case, text, message) => {
    expect(parseSkillMarkdown(text).error).toContain(message);
  });
});

describe('findSkillFile', () => {
  const file = (path: string) => {
    const created = new File(['x'], path.split('/').at(-1) ?? path);
    Object.defineProperty(created, 'webkitRelativePath', { value: path });
    return created;
  };

  it('picks the top-most SKILL.md in a folder', () => {
    const found = findSkillFile([file('deal/examples/SKILL.md'), file('deal/SKILL.md'), file('deal/table.md')]);

    expect(found?.webkitRelativePath).toBe('deal/SKILL.md');
  });

  it('reads a single picked file whatever its name', () => {
    expect(findSkillFile([new File(['x'], 'deal-summaries.md')])?.name).toBe('deal-summaries.md');
  });

  it('finds nothing when no file in a folder is named SKILL.md', () => {
    expect(findSkillFile([file('deal/notes.md'), file('deal/table.md')])).toBeUndefined();
  });
});
