import { describe, expect, it } from 'vitest';
import { buildResumeSpanInput } from './resume-span-input';

describe('buildResumeSpanInput', () => {
  describe('when the suspended tool is unknown', () => {
    it('records an object as-is', () => {
      expect(buildResumeSpanInput({ approved: true })).toEqual({ approved: true });
    });

    it('wraps a primitive, an array and null under resumeData', () => {
      expect(buildResumeSpanInput(42)).toEqual({ resumeData: 42 });
      expect(buildResumeSpanInput('yes')).toEqual({ resumeData: 'yes' });
      expect(buildResumeSpanInput([1, 2])).toEqual({ resumeData: [1, 2] });
      expect(buildResumeSpanInput(null)).toEqual({ resumeData: null });
      expect(buildResumeSpanInput(undefined)).toEqual({ resumeData: undefined });
    });
  });

  describe('when the suspended tool is known', () => {
    const tool = { toolName: 'findUser', toolCallId: 'call_1' };

    it('adds the tool identity to object resume data', () => {
      expect(buildResumeSpanInput({ name: 'Dero' }, tool)).toEqual({ name: 'Dero', ...tool });
    });

    it('wraps a primitive and adds the tool identity', () => {
      expect(buildResumeSpanInput(42, tool)).toEqual({ resumeData: 42, ...tool });
    });

    it('nests the resume data when it names a different tool', () => {
      expect(buildResumeSpanInput({ toolName: 'other', name: 'Dero' }, tool)).toEqual({
        resumeData: { toolName: 'other', name: 'Dero' },
        ...tool,
      });
      expect(buildResumeSpanInput({ toolCallId: 'call_9' }, tool)).toEqual({
        resumeData: { toolCallId: 'call_9' },
        ...tool,
      });
    });

    it('keeps matching tool fields flat', () => {
      expect(buildResumeSpanInput({ toolName: 'findUser', name: 'Dero' }, tool)).toEqual({ name: 'Dero', ...tool });
    });

    it("does not mutate the caller's object", () => {
      const resumeData = { name: 'Dero' };
      buildResumeSpanInput(resumeData, tool);
      expect(resumeData).toEqual({ name: 'Dero' });
    });
  });
});
