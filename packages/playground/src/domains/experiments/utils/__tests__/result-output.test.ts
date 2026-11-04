import { describe, expect, it } from 'vitest';

import {
  agentFailedResult,
  agentMarkdownResult,
  agentNoFinalTextResult,
  agentToolCallsResult,
  workflowResult,
} from '../../components/__tests__/fixtures/experiment-results';
import {
  getMissingTextNotice,
  getOptionalResultColumns,
  getResultErrorMessage,
  getResultOutputPreview,
  getResultOutputText,
  getResultToolCalls,
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

describe('getResultToolCalls', () => {
  describe('when an agent called tools', () => {
    it('pairs each call with its result by toolCallId', () => {
      expect(getResultToolCalls(agentNoFinalTextResult)).toEqual([
        { toolName: 'searchDocs', args: { query: 'pricing' }, result: { hits: 3 }, isError: false },
        { toolName: 'readDocs', args: { path: '/pricing' } },
      ]);
    });
  });

  describe('when the result is a workflow result', () => {
    it('returns no tool calls', () => {
      expect(getResultToolCalls(workflowResult)).toEqual([]);
    });
  });
});

describe('getMissingTextNotice', () => {
  describe('when the agent called tools but wrote no text', () => {
    it('reports how many tool calls ran', () => {
      expect(getMissingTextNotice(agentNoFinalTextResult)).toBe('No final text response after 2 tool calls');
    });
  });

  describe('when the agent answered after calling tools', () => {
    it('returns undefined', () => {
      expect(getMissingTextNotice(agentToolCallsResult)).toBeUndefined();
    });
  });

  describe('when the agent failed', () => {
    it('leaves the error to explain the missing text', () => {
      expect(
        getMissingTextNotice({
          ...agentFailedResult,
          output: { ...agentNoFinalTextResult.output, error: { message: 'boom' } },
        }),
      ).toBeUndefined();
    });
  });
});
