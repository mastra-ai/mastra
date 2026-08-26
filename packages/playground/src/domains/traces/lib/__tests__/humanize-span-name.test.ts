import { describe, expect, it } from 'vitest';

import { humanizeSpanName } from '../humanize-span-name';

describe('humanizeSpanName', () => {
  describe('structured fields (level 1)', () => {
    it.each([
      [{ spanType: 'agent_run', entityId: 'chef-agent', name: "agent run: 'chef-agent'" }, 'Called agent chef-agent'],
      [{ spanType: 'tool_call', entityId: 'weatherInfo', name: "tool: 'weatherInfo'" }, 'Used tool weatherInfo'],
      [{ spanType: 'mcp_tool_call', entityId: 'search', name: 'whatever' }, 'Used tool search'],
      [
        { spanType: 'processor_run', entityId: 'moderation', name: 'input processor: moderation' },
        'Ran processor moderation',
      ],
      [{ spanType: 'workflow_run', entityId: 'wf', name: "workflow run: 'wf'" }, 'Ran workflow wf'],
      [{ spanType: 'workflow_step', entityId: 'step-1', name: "workflow step: 'step-1'" }, 'Workflow step step-1'],
      [
        { spanType: 'model_generation', attributes: { model: 'gpt-4o' }, name: "llm: 'gpt-4o'" },
        'Generated with model gpt-4o',
      ],
    ])('renders %j as prose', (span, expected) => {
      expect(humanizeSpanName(span)).toBe(expected);
    });
  });

  describe('name patterns (level 2 fallback)', () => {
    it.each([
      ["agent run: 'chef-agent' (resumed)", 'Called agent chef-agent'],
      ["tool: 'weatherInfo'", 'Used tool weatherInfo'],
      ['input processor: moderation', 'Ran processor moderation'],
      ['output stream processor: redact', 'Ran processor redact'],
      ["workflow run: 'wf'", 'Ran workflow wf'],
      ["workflow step: 'step-1'", 'Workflow step step-1'],
      ['workspace:filesystem:read_file', 'Workspace filesystem: read_file'],
      ["llm: 'gpt-4o'", 'Generated with model gpt-4o'],
    ])('parses %s', (name, expected) => {
      expect(humanizeSpanName({ name })).toBe(expected);
    });
  });

  it('falls back to the raw name when nothing matches (level 3)', () => {
    expect(humanizeSpanName({ name: 'some custom span', spanType: 'generic' })).toBe('some custom span');
  });

  it('never throws on an empty span', () => {
    expect(humanizeSpanName({})).toBe('');
  });
});
