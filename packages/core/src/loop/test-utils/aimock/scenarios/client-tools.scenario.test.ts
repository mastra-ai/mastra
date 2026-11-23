import { jsonSchema, stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Client tools scenario.
 *
 * Tests that client-side tools (defined via clientTools parameter) are properly
 * merged with agent-level tools and can be called by the model during execution.
 */
describeForAllEngines('AIMock scenario: client tools', engine => {
  const getMock = useLoopScenarioAimock();

  it('should merge client tools with agent tools in request', async () => {
    // Create an agent-level tool
    const agentTool = createTool({
      id: 'agent-tool',
      description: 'A tool defined at agent level',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => ({ result: `agent: ${input}` }),
    });

    // Create a client-level tool
    const clientTool = createTool({
      id: 'client-tool',
      description: 'A tool defined at client level',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => ({ result: `client: ${input}` }),
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      tools: { 'agent-tool': agentTool },
      clientTools: { 'client-tool': clientTool },
      stopWhen: stepCountIs(1),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { content: 'Hello!' });
      },
    });

    // Verify both tools were included in the request
    const firstRequest = requests[0];
    expect(firstRequest?.body).toBeDefined();

    const toolDefinitions = firstRequest?.body?.tools || [];
    const agentToolDef = toolDefinitions.find((t: any) => t.function.name === 'agent-tool');
    const clientToolDef = toolDefinitions.find((t: any) => t.function.name === 'client-tool');

    expect(agentToolDef).toBeDefined();
    expect(agentToolDef?.function.description).toBe('A tool defined at agent level');

    expect(clientToolDef).toBeDefined();
    expect(clientToolDef?.function.description).toBe('A tool defined at client level');
  });

  it('should pass client tools to model in request', async () => {
    const clientTool = createTool({
      id: 'client-tool',
      description: 'A client-side tool',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ answer: `Answer for: ${query}` }),
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use the client tool',
      clientTools: { 'client-tool': clientTool },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call-client',
                name: 'client-tool',
                arguments: { query: 'test' },
              },
            ],
          },
        );

        llm.on({ endpoint: 'chat', toolCallId: 'call-client', hasToolResult: true }, { content: 'Done' });
      },
    });

    // Verify the client tool was included in the model request
    const firstRequest = requests[0];
    expect(firstRequest?.body).toBeDefined();

    const toolDefinitions = firstRequest?.body?.tools || [];
    const clientToolDef = toolDefinitions.find((t: any) => t.function.name === 'client-tool');
    expect(clientToolDef).toBeDefined();
    expect(clientToolDef?.function.description).toBe('A client-side tool');
  });

  it('continues after an opt-in render-only tool without a browser result (#26183)', async () => {
    const renderCard = createTool({
      id: 'render-card',
      description: 'Display a product card',
      inputSchema: z.object({ productId: z.string() }),
      renderOnly: true,
    });

    const { output, chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Show product sku-1 and explain it',
      clientTools: { 'render-card': renderCard },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call-card', name: 'render-card', arguments: { productId: 'sku-1' } }],
          },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call-card', hasToolResult: true },
          {
            content: 'Here is the product card for sku-1.',
          },
        );
      },
    });

    expect(requests).toHaveLength(2);
    expect(
      (chunks ?? []).find((chunk: any) => chunk.type === 'tool-result' && chunk.payload?.toolCallId === 'call-card'),
    ).toMatchObject({
      payload: { result: { acknowledged: true } },
    });
    expect(await output.text).toBe('Here is the product card for sku-1.');
  });

  it('should stream a completed server tool result when a client tool stays pending in the same step (#21637)', async () => {
    // A server-side tool (has execute) and a client-side tool (no execute, resolved by the
    // browser) are called in the same step. The turn ends so the client can resolve its own
    // tool, but the server tool already finished — its result must still be streamed, or the
    // client sits on an unresolved tool call forever and never sends the follow-up request.
    const serverTool = createTool({
      id: 'server-tool',
      description: 'Runs on the server',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ record: `record-${id}` }),
    });

    const browserTool = createTool({
      id: 'browser-tool',
      description: 'Runs in the browser',
      inputSchema: z.object({ id: z.string() }),
      // No execute: the client executes this one and sends the result back.
    });

    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use both tools',
      tools: { 'server-tool': serverTool },
      clientTools: { 'browser-tool': browserTool },
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call-server', name: 'server-tool', arguments: { id: '42' } },
              { id: 'call-browser', name: 'browser-tool', arguments: { id: '42' } },
            ],
          },
        );
      },
    });

    const toolResults = (chunks ?? []).filter((c: any) => c.type === 'tool-result');

    // The completed server-side tool is streamed as a terminal result...
    const serverResult = toolResults.find((c: any) => c.payload?.toolCallId === 'call-server');
    expect(serverResult).toBeDefined();
    expect((serverResult as any)?.payload?.result).toEqual({ record: 'record-42' });

    // ...while the client-side tool stays unresolved for the client to complete.
    expect(toolResults.some((c: any) => c.payload?.toolCallId === 'call-browser')).toBe(false);

    // The turn really did end at the pending client call: exactly one model request. Without
    // this the loop can re-invoke the model on a result nobody produced while the assertions
    // above still pass (issue #23295 — durable only).
    expect(requests.length).toBe(1);
  });

  // Technical: client tools arrive over HTTP with a plain JSON Schema inputSchema. Converting
  // that JSON Schema to Zod turned every anyOf into intersection(any, union), which the OpenAI
  // compat layer then closed into an empty object, so the model was offered `{}` instead of
  // the union and could only send empty values.
  it('offers the model every branch of a union in a JSON Schema client tool', async () => {
    const action = (op: string, fields: Record<string, unknown>, required: string[] = []) => ({
      type: 'object',
      properties: { op: { type: 'string', enum: [op] }, ...fields },
      required: ['op', ...required],
    });
    // Shape of a client tool after @mastra/client-js serializes it for the request body.
    const editDocument = {
      id: 'edit-document',
      description: 'Apply edits to a document',
      inputSchema: {
        type: 'object',
        properties: {
          edits: {
            type: 'array',
            items: {
              anyOf: [
                action('insert', { text: { type: 'string' }, at: { type: 'integer' } }, ['text']),
                action('delete', { from: { type: 'integer' }, to: { type: 'integer' } }, ['from', 'to']),
              ],
            },
          },
          cursor: { anyOf: [{ type: 'string' }, { type: 'integer' }] },
        },
        required: ['edits', 'cursor'],
      },
      renderOnly: true,
    };
    const args = {
      edits: [
        { op: 'insert', text: 'Hi', at: 0 },
        { op: 'delete', from: 2, to: 4 },
      ],
      cursor: 3,
    };

    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Insert Hi at the start and delete characters 2 to 4',
      clientTools: { 'edit-document': editDocument as any },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-edit', name: 'edit-document', arguments: args }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-edit', hasToolResult: true }, { content: 'Edited.' });
      },
    });

    const tool = (requests[0]?.body?.tools ?? []).find((t: any) => t.function.name === 'edit-document');
    const parameters = tool?.function.parameters;
    const branches = parameters?.properties?.edits?.items?.anyOf ?? [];
    expect(branches.map((b: any) => b.properties?.op?.enum)).toEqual([['insert'], ['delete']]);
    expect(Object.keys(branches[0].properties)).toEqual(['op', 'text', 'at']);
    expect(Object.keys(branches[1].properties)).toEqual(['op', 'from', 'to']);
    expect(parameters?.properties?.cursor?.anyOf?.map((b: any) => b.type)).toEqual(['string', 'integer']);

    // A call that matches the union is accepted and keeps its values.
    const toolCall = (chunks ?? []).find((c: any) => c.type === 'tool-call' && c.payload?.toolCallId === 'call-edit');
    expect((toolCall as any)?.payload?.args).toEqual(args);
    expect((chunks ?? []).some((c: any) => c.type === 'tool-error')).toBe(false);
    expect(
      (chunks ?? []).find((c: any) => c.type === 'tool-result' && c.payload?.toolCallId === 'call-edit'),
    ).toMatchObject({ payload: { result: { acknowledged: true } } });
  });

  // Technical: an AI SDK `jsonSchema()` wrapper is neither Zod nor a standard schema, so it took
  // the same Zod round-trip as a plain JSON Schema and reached the model as `{}`.
  it('offers the model every branch of a union in an AI SDK jsonSchema() tool', async () => {
    const setCursor = {
      id: 'set-cursor',
      description: 'Move the cursor',
      inputSchema: jsonSchema({
        type: 'object',
        properties: { cursor: { anyOf: [{ type: 'string' }, { type: 'integer' }] } },
        required: ['cursor'],
      }),
      renderOnly: true,
    };

    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Move the cursor to 3',
      clientTools: { 'set-cursor': setCursor as any },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-cursor', name: 'set-cursor', arguments: { cursor: 3 } }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-cursor', hasToolResult: true }, { content: 'Moved.' });
      },
    });

    const tool = (requests[0]?.body?.tools ?? []).find((t: any) => t.function.name === 'set-cursor');
    expect(tool?.function.parameters?.properties?.cursor?.anyOf?.map((b: any) => b.type)).toEqual([
      'string',
      'integer',
    ]);
    expect(
      (chunks ?? []).find((c: any) => c.type === 'tool-result' && c.payload?.toolCallId === 'call-cursor'),
    ).toMatchObject({ payload: { result: { acknowledged: true } } });
  });

  it('rejects client tool arguments that match no branch of a JSON Schema union', async () => {
    const pickColor = {
      id: 'pick-color',
      description: 'Pick a color',
      inputSchema: {
        type: 'object',
        properties: {
          color: {
            anyOf: [
              { type: 'object', properties: { hex: { type: 'string' } }, required: ['hex'] },
              { type: 'object', properties: { name: { type: 'string', enum: ['red', 'blue'] } }, required: ['name'] },
            ],
          },
        },
        required: ['color'],
      },
      renderOnly: true,
    };

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Pick green',
      clientTools: { 'pick-color': pickColor as any },
      stopWhen: stepCountIs(2),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-color', name: 'pick-color', arguments: { color: { name: 'green' } } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Could not pick that color.' });
      },
    });

    const result = (chunks ?? []).find(
      (c: any) => (c.type === 'tool-result' || c.type === 'tool-error') && c.payload?.toolCallId === 'call-color',
    ) as any;
    expect(result?.payload?.result).not.toEqual({ acknowledged: true });
    expect(JSON.stringify(result?.payload)).toMatch(/validation failed/i);
  });
});
