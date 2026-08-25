import { describe, expect, it } from 'vitest';

import { renderReviewReport, reviewReportSchema } from './review-report.js';

const RUNTIME = { modelId: 'anthropic/claude-opus-5', thinkingLevel: 'high' } as const;

const APPROVE = {
  verdict: 'approve',
  findings: [
    { subject: 'Reconcile sweep', location: 'src/rules.ts:42', body: 'Covers the merged-after-approve case.' },
  ],
  verification: [{ command: 'pnpm test', outcome: 'pass' }],
  adversarialCheck: 'The strongest request-changes case rests on a path the tests cover.',
};

describe('review report', () => {
  it('opens with the verdict and closes with the runtime that published it', () => {
    const body = renderReviewReport(reviewReportSchema.parse(APPROVE), RUNTIME);

    expect(body.startsWith('Verdict: approve\n')).toBe(true);
    expect(body.trimEnd().endsWith('Review runtime: anthropic/claude-opus-5, reasoning setting: high.')).toBe(true);
  });

  // The line is composed, never copied: a session that switches model mid-thread
  // published its second review under the first review's model.
  it('attributes each render to the runtime it is given', () => {
    const report = reviewReportSchema.parse(APPROVE);

    const first = renderReviewReport(report, { modelId: 'anthropic/claude-opus-4-8', thinkingLevel: 'low' });
    const second = renderReviewReport(report, RUNTIME);

    expect(first).toContain('Review runtime: anthropic/claude-opus-4-8, reasoning setting: low.');
    expect(second).toContain('Review runtime: anthropic/claude-opus-5, reasoning setting: high.');
  });

  it('drops the footer rather than inventing a runtime', () => {
    expect(renderReviewReport(reviewReportSchema.parse(APPROVE), null)).not.toContain('Review runtime');
  });

  it('keeps empty sections out of the body', () => {
    const body = renderReviewReport(reviewReportSchema.parse(APPROVE), RUNTIME);

    expect(body).toContain('## Findings');
    expect(body).not.toContain('## Open questions');
  });

  it('refuses an approve with no adversarial check', () => {
    expect(reviewReportSchema.safeParse({ ...APPROVE, adversarialCheck: undefined }).success).toBe(false);
  });

  it('refuses an approve that ran nothing and says nothing about it', () => {
    expect(reviewReportSchema.safeParse({ ...APPROVE, verification: [] }).success).toBe(false);
    expect(
      reviewReportSchema.safeParse({ ...APPROVE, verification: [], verificationGap: 'The sandbox had no toolchain.' })
        .success,
    ).toBe(true);
  });

  it('refuses a request-changes verdict that requests nothing', () => {
    expect(reviewReportSchema.safeParse({ verdict: 'request-changes' }).success).toBe(false);
    expect(
      reviewReportSchema.safeParse({
        verdict: 'request-changes',
        requestedChanges: [{ subject: 'Cover the reopen path', body: 'Add a case for a reopened pull request.' }],
      }).success,
    ).toBe(true);
  });
});
