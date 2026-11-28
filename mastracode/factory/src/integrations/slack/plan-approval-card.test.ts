import { describe, expect, it } from 'vitest';

import { parsePlanDigest } from '../../tools/plan-digest.js';
import {
  parsePlanApproveActionId,
  planApprovalCard,
  planApprovalText,
  planApproveActionId,
  planResolvedCard,
} from './plan-approval-card.js';

const TARGET = {
  sessionId: 'session-w',
  toolCallId: 'call-1',
  subject: 'The work session for #7',
  sessionUrl: 'https://factory.example.com/factories/f-1/workspaces/session-w/threads/thread-w',
};

const PLAN = parsePlanDigest(
  '.artifacts/plans/a.md',
  `# Add dark mode

## Goal
Let people switch the UI to a dark theme.

## Scope
In: a theme toggle.

## Phases
### Phase 1: Tokens
### Phase 2: Toggle

## Risks
- Contrast regressions.

## Open questions
- Follow the OS setting?
`,
);

type Node = { type: string; content?: string; id?: string; label?: string; url?: string; children?: Node[] };

function walk(node: Node): Node[] {
  return [node, ...(node.children ?? []).flatMap(walk)];
}

const texts = (card: Node) =>
  walk(card)
    .filter(node => node.type === 'text')
    .map(node => node.content!);
const buttons = (card: Node) => walk(card).filter(node => node.type === 'button' || node.type === 'link-button');

describe('plan approve action ids', () => {
  it('round-trip the session and call, and ignore every other action', () => {
    const id = planApproveActionId('session-w', 'call:with:colons');
    expect(parsePlanApproveActionId(id)).toEqual({ sessionId: 'session-w', toolCallId: 'call:with:colons' });
    expect(parsePlanApproveActionId('tool_approve:call-1')).toBeNull();
    expect(parsePlanApproveActionId('factory_plan:approve:')).toBeNull();
    expect(parsePlanApproveActionId('factory_plan:approve:session-w:')).toBeNull();
  });
});

describe('planApprovalCard', () => {
  it('shows what the plan says, one Approve button and a link to the full plan', () => {
    const card = planApprovalCard(PLAN, TARGET) as unknown as Node & { title: string };
    expect(card.title).toBe('📋 Plan ready for review: Add dark mode');
    expect(texts(card)).toEqual([
      'The work session for #7 submitted this plan and is waiting for approval.',
      '**Goal**\nLet people switch the UI to a dark theme.',
      '**Scope**\nIn: a theme toggle.',
      '**Phases**\n• Phase 1: Tokens\n• Phase 2: Toggle',
      '**Risks**\n- Contrast regressions.',
      '**Open questions**\n- Follow the OS setting?',
      'Reply in this thread to request changes.',
    ]);
    expect(buttons(card)).toEqual([
      expect.objectContaining({ type: 'button', id: 'factory_plan:approve:session-w:call-1', label: 'Approve' }),
      expect.objectContaining({ type: 'link-button', label: 'Open full plan', url: TARGET.sessionUrl }),
    ]);
    // No Request changes button: changes are asked for by replying in the thread.
    expect(buttons(card)).toHaveLength(2);
  });

  it('keeps every section of a huge plan under Slack’s block limits', () => {
    const huge = parsePlanDigest(
      '.artifacts/plans/big.md',
      `# Big\n\n## Goal\n${'g'.repeat(9000)}\n\n## Scope\n${'s'.repeat(9000)}\n\n## Phases\n${Array.from(
        { length: 60 },
        (_, i) => `### Phase ${i + 1}`,
      ).join('\n')}\n\n## Risks\n${'r'.repeat(9000)}\n\n## Open questions\n${'q'.repeat(9000)}`,
    );
    const card = planApprovalCard(huge, TARGET) as unknown as Node;
    for (const text of texts(card)) expect(text.length).toBeLessThan(3000);
    expect(walk(card).length).toBeLessThan(50);
    expect(texts(card).join('\n')).toContain('• …and 45 more');
  });

  it('quotes a plan without the usual headings from its start', () => {
    const card = planApprovalCard(
      parsePlanDigest('.artifacts/plans/a.md', 'Just fix the bug.'),
      TARGET,
    ) as unknown as Node;
    expect(texts(card)).toContain('Just fix the bug.');
  });

  it('offers no Approve button for a plan nobody could read, and says why', () => {
    const card = planApprovalCard(
      { ok: false, path: '.artifacts/plans/a.md', reason: 'the plan text was not sent with the submission' },
      TARGET,
    ) as unknown as Node;
    expect(texts(card).join('\n')).toContain(
      "The plan in `.artifacts/plans/a.md` can't be shown here (the plan text was not sent with the submission)",
    );
    expect(buttons(card)).toEqual([expect.objectContaining({ type: 'link-button', label: 'Open full plan' })]);
  });
});

describe('planResolvedCard', () => {
  it('says who approved the plan, with no buttons left to click', () => {
    const card = planResolvedCard(PLAN, TARGET, { kind: 'approved', by: '<@U1>' }) as unknown as Node & {
      title: string;
    };
    expect(card.title).toBe('✅ Plan approved: Add dark mode');
    expect(texts(card)).toEqual(['Approved by <@U1>.']);
    expect(buttons(card).map(button => button.type)).toEqual(['link-button']);
  });

  it('says when changes were requested, or the call is no longer waiting', () => {
    const changes = planResolvedCard(PLAN, TARGET, { kind: 'changes-requested' }) as unknown as { title: string };
    expect(changes.title).toBe('✏️ Changes requested: Add dark mode');
    const stale = planResolvedCard(PLAN, TARGET, { kind: 'stale' }) as unknown as Node;
    expect(texts(stale)[0]).toContain('already answered');
  });
});

describe('planApprovalText', () => {
  it('carries the plan and where to approve it, and never claims it was approved', () => {
    const text = planApprovalText(PLAN, TARGET);
    expect(text).toContain('Goal:\nLet people switch the UI to a dark theme.');
    expect(text).toContain(`Approve it in the session: ${TARGET.sessionUrl}`);
    expect(text).not.toMatch(/was approved|approved by/i);
  });
});
