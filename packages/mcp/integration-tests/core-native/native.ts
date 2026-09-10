import assert from 'node:assert/strict';
import { createMCPTool, isMCPToolV2 } from '@mastra/core/mcp';
import type { MCPToolExecutionContextV2 } from '@mastra/core/mcp';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';

const confirmation = createMCPTool({
  id: 'confirmation',
  description: 'Ask for confirmation',
  inputSchema: z.object({}),
  outputSchema: z.boolean(),
  execute: (_, { request }) => {
    const response = request.inputResponses?.confirmation;
    if (response) return { kind: 'completed', value: response.action === 'accept' };
    return {
      kind: 'input_required',
      result: {
        resultType: 'input_required',
        inputRequests: {
          confirmation: {
            method: 'elicitation/create',
            params: { mode: 'form', message: 'Continue?', requestedSchema: { type: 'object', properties: {} } },
          },
        },
      },
    };
  },
});

const context: MCPToolExecutionContextV2 = {
  requestContext: new RequestContext(),
  request: {
    protocolVersion: '2026-07-28',
    requestId: 'first',
    signal: new AbortController().signal,
    log: async () => {},
    progress: async () => {},
  },
};
assert.equal(isMCPToolV2(confirmation), true);
assert.equal('execute' in confirmation, false);
const first = await confirmation.invoke({}, context);
assert.equal(first.kind, 'input_required');
const accepted = await confirmation.invoke(
  {},
  {
    ...context,
    request: { ...context.request, requestId: 'second', inputResponses: { confirmation: { action: 'accept' } } },
  },
);
assert.deepEqual(accepted, { kind: 'completed', value: true });
const declined = await confirmation.invoke(
  {},
  {
    ...context,
    request: { ...context.request, requestId: 'third', inputResponses: { confirmation: { action: 'decline' } } },
  },
);
assert.deepEqual(declined, { kind: 'completed', value: false });
assert.throws(() => {
  // @ts-expect-error native tools must not enter business-tool registries, including through packed declarations
  new Mastra({ tools: { confirmation } });
}, /Native MCP tools/);
console.log(
  'PACKED CORE NATIVE PASS: independent native exports, input rounds, validated completion, business registry rejection',
);
