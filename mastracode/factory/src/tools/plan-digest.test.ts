import { describe, expect, it, vi } from 'vitest';

import { formatPlanDigestText, parsePlanDigest, planFilePath, readPlanDigest } from './plan-digest.js';

const PLAN = `# Add dark mode

## Repository
mastra-ai/mastra

## Goal
Let people switch the UI to a dark theme.

## Scope
In:
1. A theme toggle in settings.
Out: redesigning the palette.

## Phases

### Phase 1: Theme tokens
Changes: add tokens.

### Phase 2: Toggle
Changes: add the toggle.

\`\`\`md
### Not a phase
\`\`\`

## Risks
- Contrast regressions.

## Open questions
- Follow the OS setting by default?
`;

describe('planFilePath', () => {
  it('accepts plans under the workspace or a checkout plans directory, relative or under the root', () => {
    expect(planFilePath('.artifacts/plans/a.md')).toBe('.artifacts/plans/a.md');
    expect(planFilePath('./.artifacts/plans/a.md')).toBe('.artifacts/plans/a.md');
    expect(planFilePath('mastra/.artifacts/plans/a.md')).toBe('mastra/.artifacts/plans/a.md');
    expect(planFilePath('/workspace/.artifacts/plans/a.md', '/workspace')).toBe('.artifacts/plans/a.md');
  });

  it('refuses anything outside a plans directory', () => {
    expect(planFilePath('.env')).toBeNull();
    expect(planFilePath('.artifacts/plans/../../.env')).toBeNull();
    expect(planFilePath('/etc/.artifacts/plans/a.md', '/workspace')).toBeNull();
    // An absolute path can't be placed without the workspace root.
    expect(planFilePath('/workspace/.artifacts/plans/a.md')).toBeNull();
  });
});

describe('parsePlanDigest', () => {
  it('quotes the title, goal, scope, phases, risks and open questions from the file', () => {
    const digest = parsePlanDigest('.artifacts/plans/a.md', PLAN);
    expect(digest).toMatchObject({
      ok: true,
      title: 'Add dark mode',
      goal: 'Let people switch the UI to a dark theme.',
      scope: 'In:\n1. A theme toggle in settings.\nOut: redesigning the palette.',
      phases: ['Phase 1: Theme tokens', 'Phase 2: Toggle'],
      risks: '- Contrast regressions.',
      openQuestions: '- Follow the OS setting by default?',
    });
    expect(digest.body.startsWith('## Repository')).toBe(true);
  });

  it('keeps a plan with none of those headings whole, untitled', () => {
    const digest = parsePlanDigest('.artifacts/plans/a.md', 'Just do the thing.\n\nThen ship it.');
    expect(digest).toMatchObject({ ok: true, phases: [], body: 'Just do the thing.\n\nThen ship it.' });
    expect(digest.title).toBeUndefined();
    expect(formatPlanDigestText(digest)).toContain('Plan excerpt:\nJust do the thing.');
  });
});

describe('formatPlanDigestText', () => {
  it('lists every section it found', () => {
    const text = formatPlanDigestText(parsePlanDigest('.artifacts/plans/a.md', PLAN));
    expect(text).toBe(
      [
        'Plan: "Add dark mode" (`.artifacts/plans/a.md`)',
        'Goal:\nLet people switch the UI to a dark theme.',
        'Scope:\nIn:\n1. A theme toggle in settings.\nOut: redesigning the palette.',
        'Phases:\n- Phase 1: Theme tokens\n- Phase 2: Toggle',
        'Risks:\n- Contrast regressions.',
        'Open questions:\n- Follow the OS setting by default?',
      ].join('\n\n'),
    );
  });

  it('keeps a huge plan within its budget, marking what it cut', () => {
    const huge = `# Big\n\n## Goal\n${'g'.repeat(5000)}\n\n## Scope\n${'s'.repeat(5000)}\n\n## Phases\n${Array.from(
      { length: 40 },
      (_, i) => `### Phase ${i + 1}\nwork`,
    ).join('\n')}\n\n## Risks\n${'r'.repeat(5000)}`;
    const text = formatPlanDigestText(parsePlanDigest('.artifacts/plans/big.md', huge), 2000);
    expect(text.length).toBeLessThanOrEqual(2000);
    expect(text).toContain('g…');
    const full = formatPlanDigestText(parsePlanDigest('.artifacts/plans/big.md', huge), 100_000);
    expect(full).toContain('- …and 28 more');
    expect(full).toContain('s…');
  });
});

describe('readPlanDigest', () => {
  it('reads the plan through the session workspace', async () => {
    const read = vi.fn(async () => ({ contentType: 'text', content: PLAN }));
    const digest = await readPlanDigest('/workspace/.artifacts/plans/a.md', read, '/workspace');
    expect(read).toHaveBeenCalledWith('.artifacts/plans/a.md');
    expect(digest).toMatchObject({ ok: true, title: 'Add dark mode', path: '.artifacts/plans/a.md' });
  });

  it('never reads a path outside the plans directory', async () => {
    const read = vi.fn();
    await expect(readPlanDigest('.env', read)).resolves.toEqual({
      ok: false,
      path: '.env',
      reason: 'it is not in the plans directory',
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('says why a plan could not be read instead of throwing', async () => {
    const unavailable = async () => {
      throw new Error('Session workspace is not available');
    };
    await expect(readPlanDigest('.artifacts/plans/a.md', unavailable)).resolves.toEqual({
      ok: false,
      path: '.artifacts/plans/a.md',
      reason: 'Session workspace is not available',
    });
    await expect(readPlanDigest('.artifacts/plans/a.md', async () => ({ content: '  ' }))).resolves.toMatchObject({
      ok: false,
      reason: 'it is empty',
    });
  });
});
