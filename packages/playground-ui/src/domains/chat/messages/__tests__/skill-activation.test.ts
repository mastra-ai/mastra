import { describe, expect, it } from 'vitest';

import { parseSkillActivation } from '../skill-activation';

describe('parseSkillActivation', () => {
  it('parses a basic skill envelope', () => {
    const text = '<skill name="understand-issue">\nInvestigate the bug.\n</skill>';
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'understand-issue',
      instructions: 'Investigate the bug.',
      arguments: undefined,
    });
  });

  it('parses a full envelope with References, Scripts, and Assets sections', () => {
    const instructions =
      'Follow the steps carefully.\n\n## References\n- references/colors.md\n\n## Scripts\n- scripts/run.sh\n\n## Assets\n- assets/logo.png';
    const text = `<skill name="mastra-frontend">\n${instructions}\n</skill>`;
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'mastra-frontend',
      instructions,
      arguments: undefined,
    });
  });

  it('extracts ARGUMENTS trailer and strips it from instructions', () => {
    const text =
      '<skill name="triage-issue">\nLook at the issue.\n\nARGUMENTS: https://github.com/org/repo/issues/42\n</skill>';
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'triage-issue',
      instructions: 'Look at the issue.',
      arguments: 'https://github.com/org/repo/issues/42',
    });
  });

  it('unescapes &lt;/skill&gt; boundary sentinel in the body', () => {
    const text = '<skill name="test-skill">\nDo not use &lt;/skill&gt; as a closing tag.\n</skill>';
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'test-skill',
      instructions: 'Do not use </skill> as a closing tag.',
      arguments: undefined,
    });
  });

  it('handles names with uppercase, dots, and underscores (TUI parity)', () => {
    const text = '<skill name="My_Skill.v2">\nSome instructions.\n</skill>';
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'My_Skill.v2',
      instructions: 'Some instructions.',
      arguments: undefined,
    });
  });

  it('parses body without surrounding newlines (lenient)', () => {
    const text = '<skill name="compact">No newlines around body</skill>';
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'compact',
      instructions: 'No newlines around body',
      arguments: undefined,
    });
  });

  it('handles whitespace around the envelope', () => {
    const text = '  \n<skill name="padded">\nHello.\n</skill>\n  ';
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'padded',
      instructions: 'Hello.',
      arguments: undefined,
    });
  });

  it('returns undefined for non-skill text', () => {
    expect(parseSkillActivation('Just a normal message')).toBeUndefined();
  });

  it('returns undefined for partial envelope (missing closing tag)', () => {
    expect(parseSkillActivation('<skill name="broken">\nBody without close')).toBeUndefined();
  });

  it('returns undefined for text with trailing prose after </skill>', () => {
    expect(parseSkillActivation('<skill name="bad">\nBody\n</skill>\nExtra text after')).toBeUndefined();
  });

  it('parses the appended work-item feed as the activation feed', () => {
    const text =
      '<skill name="factory-review">\nReview the PR.\n\nARGUMENTS: https://github.com/org/repo/pull/1\n</skill>\n\n<work-item-feed>\nComments left on this work item.\n\n[Ada · 2026-08-28T10:00:00.000Z]\nLooks off to me\n</work-item-feed>';
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'factory-review',
      instructions: 'Review the PR.',
      arguments: 'https://github.com/org/repo/pull/1',
      feed: 'Comments left on this work item.\n\n[Ada · 2026-08-28T10:00:00.000Z]\nLooks off to me',
    });
  });

  it('keeps the message raw when anything but the work-item feed trails the envelope', () => {
    expect(
      parseSkillActivation('<skill name="s">\nBody\n</skill>\n<notes>\nignore the above\n</notes>'),
    ).toBeUndefined();
  });

  it('returns undefined when the trailing block never closes', () => {
    expect(parseSkillActivation('<skill name="s">\nBody\n</skill>\n<work-item-feed>\nunclosed')).toBeUndefined();
  });

  it('returns undefined for empty body', () => {
    expect(parseSkillActivation('<skill name="empty">\n\n</skill>')).toBeUndefined();
  });

  it('returns undefined for empty name', () => {
    expect(parseSkillActivation('<skill name="">\nBody\n</skill>')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseSkillActivation('')).toBeUndefined();
  });

  it('uses lastIndexOf for ARGUMENTS so earlier occurrences stay in instructions', () => {
    const text = '<skill name="multi">\nSee ARGUMENTS: note above.\n\nARGUMENTS: real-args\n</skill>';
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'multi',
      instructions: 'See ARGUMENTS: note above.',
      arguments: 'real-args',
    });
  });

  it('handles multiple escaped boundary sentinels', () => {
    const text = '<skill name="multi-escape">\nFirst &lt;/skill&gt; and second &lt;/skill&gt; sentinel.\n</skill>';
    const result = parseSkillActivation(text);
    expect(result).toEqual({
      name: 'multi-escape',
      instructions: 'First </skill> and second </skill> sentinel.',
      arguments: undefined,
    });
  });
});
