import { describe, expect, it } from 'vitest';

import { formatPlanDigestText, parsePlanDigest, submittedPlanDigest } from './plan-digest.js';

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

describe('submittedPlanDigest', () => {
  it('digests the text the submit_plan call paused with, title included', () => {
    const [heading, ...rest] = PLAN.split('\n');
    const digest = submittedPlanDigest('.artifacts/plans/a.md', {
      title: heading!.slice(2),
      plan: rest.join('\n'),
    });
    expect(digest).toMatchObject({
      ok: true,
      path: '.artifacts/plans/a.md',
      title: 'Add dark mode',
      goal: 'Let people switch the UI to a dark theme.',
      phases: ['Phase 1: Theme tokens', 'Phase 2: Toggle'],
    });
  });

  it('keeps an untitled plan untitled', () => {
    expect(submittedPlanDigest('.artifacts/plans/a.md', { title: '', plan: 'Just do it.' })).toMatchObject({
      ok: true,
      body: 'Just do it.',
    });
    expect(submittedPlanDigest('.artifacts/plans/a.md', { title: '', plan: 'Just do it.' })).not.toHaveProperty(
      'title',
    );
  });

  it('says the plan is missing, never reads the file, when the call paused without its text', () => {
    for (const payload of [{}, { plan: '   ' }, { plan: 42 }]) {
      expect(submittedPlanDigest('.artifacts/plans/a.md', payload)).toEqual({
        ok: false,
        path: '.artifacts/plans/a.md',
        reason: 'the plan text was not sent with the submission',
      });
    }
  });
});
