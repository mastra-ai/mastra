import { describe, expect, it } from 'vitest';
import { normalizeResumeGenerateArgs } from './resume-generate-args';

describe('normalizeResumeGenerateArgs', () => {
  it('reads the Agent form', () => {
    expect(normalizeResumeGenerateArgs([{ approved: true }, { runId: 'r1', toolCallId: 't1' }])).toEqual({
      runId: 'r1',
      resumeData: { approved: true },
      options: { toolCallId: 't1' },
    });
  });

  it('reads the deprecated form', () => {
    expect(normalizeResumeGenerateArgs(['r1', { approved: true }])).toEqual({
      runId: 'r1',
      resumeData: { approved: true },
      options: {},
    });
  });

  it('keeps a runId inside resume data when the deprecated form passes options', () => {
    expect(normalizeResumeGenerateArgs(['run-A', { runId: 'other', approved: true }, {}])).toEqual({
      runId: 'run-A',
      resumeData: { runId: 'other', approved: true },
      options: {},
    });
  });

  it('throws instead of guessing when both forms match', () => {
    expect(() => normalizeResumeGenerateArgs(['run-A', { runId: 'other', approved: true }])).toThrow(
      /matches both call forms/,
    );
  });

  it('throws when no runId is given', () => {
    expect(() => normalizeResumeGenerateArgs([{ approved: true }])).toThrow(/requires a runId/);
  });
});
