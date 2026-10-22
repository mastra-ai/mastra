import { describe, expect, it } from 'vitest';

import {
  agentFailedResult,
  agentMarkdownResult,
  workflowResult,
} from '../../components/__tests__/fixtures/experiment-results';
import {
  getOptionalResultColumns,
  getResultErrorMessage,
  getResultOutputPreview,
  getResultOutputText,
} from '../result-output';

describe('getResultOutputText', () => {
  describe('when the result is an agent result with text', () => {
    it('returns the text', () => {
      expect(getResultOutputText(agentMarkdownResult)).toBe('# Title\n\n**bold**');
    });
  });

  describe('when the result is a workflow result', () => {
    it('returns undefined', () => {
      expect(getResultOutputText(workflowResult)).toBeUndefined();
    });
  });
});

describe('getResultOutputPreview', () => {
  it('uses the agent text', () => {
    expect(getResultOutputPreview(agentMarkdownResult)).toBe('# Title\n\n**bold**');
  });

  it('falls back to a plain string output when the target is unknown', () => {
    expect(getResultOutputPreview({ targetType: null, output: 'Try a frittata.' })).toBe('Try a frittata.');
  });

  it('falls back to compact JSON for structured output', () => {
    expect(getResultOutputPreview({ targetType: null, output: { dish: 'panna cotta' } })).toBe(
      '{"dish":"panna cotta"}',
    );
  });

  it('returns undefined when there is no output', () => {
    expect(getResultOutputPreview({ targetType: null, output: null })).toBeUndefined();
  });

  it('keeps typed non-agent output out of the list', () => {
    expect(getResultOutputPreview(workflowResult)).toBeUndefined();
  });
});

describe('getResultErrorMessage', () => {
  describe('when only the agent output carries the error', () => {
    it('falls back to the output error message', () => {
      expect(getResultErrorMessage({ ...agentFailedResult, error: null })).toBe('model exploded');
    });
  });

  describe('when the result succeeded', () => {
    it('returns undefined', () => {
      expect(getResultErrorMessage(agentMarkdownResult)).toBeUndefined();
    });
  });
});

describe('getOptionalResultColumns', () => {
  describe('when results include agent text and errors', () => {
    it('returns output and error columns', () => {
      expect(getOptionalResultColumns([agentMarkdownResult, agentFailedResult]).map(c => c.name)).toEqual([
        'output',
        'error',
      ]);
    });
  });

  describe('when no result has output text or errors', () => {
    it('returns no columns', () => {
      expect(getOptionalResultColumns([workflowResult])).toEqual([]);
    });
  });
});
