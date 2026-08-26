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

  it.each(['tool_call', 'client_tool_call', 'provider_tool_call'])('links %s to the tool page', spanType => {
    expect(spanEntityLink(span(spanType, 'weatherInfo'))).toBe('/tools/weatherInfo');
  });

  it('links a processor run to the processor page', () => {
    expect(spanEntityLink(span('processor_run', 'moderation'))).toBe('/processors/moderation');
  });

  it('links a workflow run to the workflow page', () => {
    expect(spanEntityLink(span('workflow_run', 'weatherWorkflow'))).toBe('/workflows/weatherWorkflow');
  });

  it('links an MCP tool call to the tool under its server', () => {
    expect(spanEntityLink(span('mcp_tool_call', 'search', { mcpServer: 'docs' }))).toBe('/mcps/docs/tools/search');
  });

  it('encodes ids so exotic names cannot break the URL', () => {
    expect(spanEntityLink(span('tool_call', 'my tool/v2'))).toBe('/tools/my%20tool%2Fv2');
  });

  it('returns nothing when the entity id is missing', () => {
    expect(spanEntityLink(span('agent_run'))).toBeUndefined();
    expect(spanEntityLink(span('mcp_tool_call', 'search'))).toBeUndefined();
  });

  it('returns nothing for kinds with no addressable page', () => {
    // A workflow step is not routable on its own, and a model generation has no entity page.
    expect(spanEntityLink(span('workflow_step', 'fetch-weather'))).toBeUndefined();
    expect(spanEntityLink(span('model_generation', 'gpt-5-mini'))).toBeUndefined();
    expect(spanEntityLink(span('workspace_action', 'read'))).toBeUndefined();
  });
});
