import { formatSkillsCatalog } from '@mastra/core/processors';
import { describe, expect, it } from 'vitest';
import { parseAvailableSkills } from '../available-skills';

describe('parseAvailableSkills', () => {
  it('reads the catalog core writes, unescaped, and keeps the text around it', () => {
    const catalog = formatSkillsCatalog([
      { name: 'a&b', description: `Uses <tags> & "quotes" it's`, location: '/a/SKILL.md', source: 'local' },
    ]);
    expect(parseAvailableSkills(`Intro\n${catalog}\nOutro`)).toEqual({
      before: 'Intro\n',
      skills: [{ name: 'a&b', description: `Uses <tags> & "quotes" it's` }],
      after: '\nOutro',
    });
  });

  it('skips skills without a name and leaves out empty descriptions', () => {
    expect(
      parseAvailableSkills(
        '<available_skills><skill><description>x</description></skill><skill><name>ok</name><description></description></skill></available_skills>',
      )?.skills,
    ).toEqual([{ name: 'ok', description: undefined }]);
  });

  it('gives nothing back for text without a readable catalog', () => {
    expect(parseAvailableSkills('no catalog here')).toBeUndefined();
    expect(parseAvailableSkills('<available_skills>\n</available_skills>')).toBeUndefined();
    expect(parseAvailableSkills('<available_skills><skill><name>a</name></skill>')).toBeUndefined();
  });
});
