import { describe, expect, it } from 'vitest';

import { spanEntityLink } from '../span-entity-link';

/** Minimal span shape; the helper only reads spanType, entityId and a couple of attributes. */
function span(spanType: string, entityId?: string, attributes?: Record<string, unknown>) {
  return { spanId: 's', spanType, entityId, attributes } as never;
}

describe('spanEntityLink', () => {
  it('links an agent run to the agent page', () => {
    expect(spanEntityLink(span('agent_run', 'chefAgent'))).toBe('/agents/chefAgent');
  });

  it('encodes ids so exotic names cannot break the URL', () => {
    expect(spanEntityLink(span('agent_run', 'my agent/v2'))).toBe('/agents/my%20agent%2Fv2');
  });

  it('returns nothing when the entity id is missing', () => {
    expect(spanEntityLink(span('agent_run'))).toBeUndefined();
  });

  it('returns nothing for kinds with no addressable page', () => {
    // Calls that open in place carry their own payload, and a model generation has no entity page.
    expect(spanEntityLink(span('tool_call', 'weatherInfo'))).toBeUndefined();
    expect(spanEntityLink(span('processor_run', 'moderation'))).toBeUndefined();
    expect(spanEntityLink(span('mcp_tool_call', 'search', { mcpServer: 'docs' }))).toBeUndefined();
    expect(spanEntityLink(span('workflow_run', 'weatherWorkflow'))).toBeUndefined();
    expect(spanEntityLink(span('workflow_step', 'fetch-weather'))).toBeUndefined();
    expect(spanEntityLink(span('model_generation', 'gpt-5-mini'))).toBeUndefined();
    expect(spanEntityLink(span('workspace_action', 'read'))).toBeUndefined();
  });
});
