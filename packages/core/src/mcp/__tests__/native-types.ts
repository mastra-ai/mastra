import { inputRequired } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { createTool } from '../../tools';
import { createStep } from '../../workflows';
import { createMCPTool } from '../index';
import type { MCPToolExecutionContextV2 } from '../index';

const native = createMCPTool({
  id: 'native',
  description: 'Native confirmation',
  inputSchema: z.object({ amount: z.number() }),
  outputSchema: z.number(),
  execute: ({ amount }) =>
    amount > 0
      ? { kind: 'completed', value: amount }
      : {
          kind: 'input_required',
          result: inputRequired({
            inputRequests: {
              confirmation: inputRequired.elicit({
                message: 'Confirm?',
                requestedSchema: z.object({ confirmed: z.boolean() }),
              }),
            },
          }),
        },
});

export async function nativeContractTypes(context: MCPToolExecutionContextV2) {
  const result = await native.invoke({ amount: 1 }, context);
  if (result.kind === 'completed') {
    const value: number = result.value;
    value.toFixed();
    // @ts-expect-error completed value is inferred from the output schema
    const incorrect: string = result.value;
    void incorrect;
  }
  // @ts-expect-error native input is inferred from the input schema
  await native.invoke({ amount: 'wrong' }, context);
  // @ts-expect-error native execution needs a separate request context
  await native.invoke({ amount: 1 }, {});
  // @ts-expect-error native context does not inherit legacy push APIs
  context.mcp.elicitation.sendRequest({});
  // @ts-expect-error native tools have no business execute API
  native.execute({ amount: 1 }, context);
  // @ts-expect-error native tools cannot enter the global business registry
  new Mastra({ tools: { native } });
  // @ts-expect-error native tools cannot enter the mutable business registry
  new Mastra().addTool(native);
  // @ts-expect-error native tools cannot enter an agent's static tool set
  new Agent({ id: 'agent', name: 'Agent', model: 'openai/gpt-5', instructions: '', tools: { native } });
  // @ts-expect-error native tools cannot enter an agent's dynamic tool set
  new Agent({ id: 'agent', name: 'Agent', model: 'openai/gpt-5', instructions: '', tools: () => ({ native }) });
  // @ts-expect-error native tools cannot become business workflow steps
  createStep(native);
}

createMCPTool({
  id: 'invalid-output',
  description: 'Type check',
  inputSchema: z.object({}),
  outputSchema: z.number(),
  // @ts-expect-error a completed value must match the output schema
  execute: () => ({ kind: 'completed', value: 'wrong' }),
});
createMCPTool({
  id: 'invalid-control',
  description: 'Type check',
  inputSchema: z.object({}),
  outputSchema: z.number(),
  // @ts-expect-error control state must be a wire string, not an application object
  execute: () => ({
    kind: 'input_required',
    result: { resultType: 'input_required', requestState: { phase: 'next' } },
  }),
});

const ordinary = createTool({
  id: 'business',
  description: 'Business output',
  inputSchema: z.object({}),
  outputSchema: z.object({ resultType: z.literal('input_required') }),
  execute: async () => ({ resultType: 'input_required' as const }),
});
new Mastra({ tools: { ordinary } });
createStep(ordinary);
