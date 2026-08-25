import { z } from 'zod';

import type { ReviewRuntime } from './review-runtime.js';

const text = z.string().trim().min(1);

const findingSchema = z
  .object({
    subject: text.describe('What the finding is about, in a few words.'),
    location: text.optional().describe('Where it lives, as `path/to/file.ts:42`.'),
    body: text.describe('The finding itself, as markdown. Ground it in the history you traced.'),
    origin: z
      .enum(['push', 'fresh'])
      .optional()
      .describe('Re-review only: whether the push raised it, or the fresh whole-PR sweep did.'),
  })
  .strict();

const verificationSchema = z
  .object({
    command: text.describe('The command exactly as it was executed.'),
    outcome: text.describe('What it reported: pass, fail, or the qualification that applies.'),
  })
  .strict();

const dispositionSchema = z
  .object({
    subject: text.describe('The prior finding, named by its subject.'),
    location: text.optional(),
    disposition: z.enum(['confirmed', 'addressed', 'refuted']),
    evidence: text.describe('Why it holds that disposition.'),
  })
  .strict();

const priorPassSchema = z
  .object({
    subject: text.describe('The prior-pass item, named by its subject.'),
    location: text.optional(),
    disposition: z.enum(['addressed', 'partially-addressed', 'still-open', 'refuted', 'invalidated']),
    evidence: text.describe('The commit or `file:line` proving the call.'),
  })
  .strict();

export const reviewReportSchema = z
  .object({
    verdict: z.enum(['approve', 'request-changes']),
    priorPass: z
      .array(priorPassSchema)
      .default([])
      .describe('Re-review only: every substantive item from the previous pass.'),
    findings: z.array(findingSchema).default([]),
    verification: z.array(verificationSchema).default([]),
    verificationGap: text.optional().describe('Why nothing was executed. Required to approve when no command ran.'),
    existingSignal: z
      .array(dispositionSchema)
      .default([])
      .describe('Every substantive prior finding — bots and your own earlier passes included.'),
    adversarialCheck: text.optional().describe('Why the strongest request-changes case fails. Required to approve.'),
    requestedChanges: z.array(findingSchema).default([]),
    assumptions: z.array(text).default([]),
    openQuestions: z.array(text).default([]),
  })
  .strict()
  .superRefine((report, ctx) => {
    if (report.verdict === 'approve') {
      if (!report.adversarialCheck) {
        ctx.addIssue({
          code: 'custom',
          path: ['adversarialCheck'],
          message: 'An approve requires the adversarial check that survived.',
        });
      }
      if (report.verification.length === 0 && !report.verificationGap) {
        ctx.addIssue({
          code: 'custom',
          path: ['verification'],
          message: 'An approve requires executed verification, or verificationGap saying why none ran.',
        });
      }
      return;
    }
    if (report.requestedChanges.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['requestedChanges'],
        message: 'A request-changes verdict requires at least one requested change.',
      });
    }
  });

export type ReviewReport = z.infer<typeof reviewReportSchema>;

function entry({
  subject,
  location,
  body,
  origin,
}: {
  subject: string;
  location?: string;
  body: string;
  origin?: string;
}): string {
  const head = `- **${subject}**${origin ? ` \`[${origin}]\`` : ''}${location ? ` — \`${location}\`` : ''}`;
  return `${head}\n\n  ${body.replaceAll('\n', '\n  ')}`;
}

function section(heading: string, lines: readonly string[]): string | null {
  return lines.length === 0 ? null : `## ${heading}\n\n${lines.join('\n\n')}`;
}

/** The published body. Its shape is this function's, never the model's. */
export function renderReviewReport(report: ReviewReport, runtime: ReviewRuntime | null): string {
  const verification = report.verification.map(({ command, outcome }) => `- \`${command}\` — ${outcome}`);
  const blocks = [
    `Verdict: ${report.verdict === 'approve' ? 'approve' : 'request changes'}`,
    section(
      'Prior pass disposition',
      report.priorPass.map(({ subject, location, disposition, evidence }) =>
        entry({ subject, location, body: `${disposition} — ${evidence}` }),
      ),
    ),
    section('Findings', report.findings.map(entry)),
    section('Verification', report.verificationGap ? [...verification, report.verificationGap] : verification),
    section(
      'Existing review disposition',
      report.existingSignal.map(({ subject, location, disposition, evidence }) =>
        entry({ subject, location, body: `${disposition} — ${evidence}` }),
      ),
    ),
    report.adversarialCheck === undefined ? null : section('Adversarial check', [report.adversarialCheck]),
    section('Requested changes', report.requestedChanges.map(entry)),
    section(
      'Assumptions',
      report.assumptions.map(assumption => `- ${assumption}`),
    ),
    section(
      'Open questions',
      report.openQuestions.map(question => `- ${question}`),
    ),
    runtime === null ? null : `Review runtime: ${runtime.modelId}, reasoning setting: ${runtime.thinkingLevel}.`,
  ];
  return `${blocks.filter(block => block !== null).join('\n\n')}\n`;
}
