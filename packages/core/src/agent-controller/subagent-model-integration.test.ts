import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RequestContext } from '../request-context';
import { createSubagentTool } from './tools';

// Keep the Agent, streaming loop and HTTP transport real. Only the paid provider is replaced.
describe('fresh subagent model selection', () => {
  const requests: Array<{ model: string }> = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    requests.push(input);
    if (input.model === 'rejected-model') {
      res.writeHead(400, { 'Content-Type': 'application/json', 'x-private-header': 'private-header' });
      res.end(
        JSON.stringify({
          error: { message: 'Requested model is unavailable for this account.' },
          debug: 'private-body',
        }),
      );
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const chunk = { id: 'response', object: 'chat.completion.chunk', created: 0, model: input.model };
    res.write(
      `data: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta: { role: 'assistant', content: 'Done.' }, finish_reason: null }] })}\n\n`,
    );
    res.write(
      `data: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })}\n\n`,
    );
    res.end('data: [DONE]\n\n');
  });
  let provider: ReturnType<typeof createOpenAI>;
  beforeAll(async () => {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    provider = createOpenAI({
      apiKey: 'test-key',
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    });
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });

  it('returns the provider rejection so the caller can correct the model', async () => {
    const tool = createSubagentTool({
      subagents: [{ id: 'explore', name: 'Explore', description: 'Explore', instructions: 'Explore' }],
      fallbackModelId: 'rejected-model',
      resolveModel: id => provider.chat(id),
    });
    const result = await tool.execute!({ agentType: 'explore', task: 'Explore' }, {});
    expect(result).toMatchObject({
      isError: true,
      content: expect.stringContaining('Requested model is unavailable for this account.'),
    });
    for (const privateValue of ['private-header', 'private-body', 'test-key']) {
      expect(result).not.toMatchObject({ content: expect.stringContaining(privateValue) });
    }
  });

  it.each([
    ['active parent', undefined, undefined, 'active-parent'],
    ['explicit tool argument', 'explicit-model', 'controller-model', 'explicit-model'],
    ['controller setting', undefined, 'controller-model', 'controller-model'],
  ])('uses the %s model at the provider', async (_label, modelId, controllerModelId, expected) => {
    const tool = createSubagentTool({
      subagents: [
        {
          id: 'explore',
          name: 'Explore',
          description: 'Explore',
          instructions: 'Explore',
          defaultModelId: 'definition-default',
        },
      ],
      getParentModelId: () => 'active-parent',
      fallbackModelId: 'fallback',
      resolveModel: id => provider.chat(id),
    });
    const requestContext = new RequestContext();
    requestContext.set('controller', { getSubagentModelId: () => controllerModelId });
    const result = await tool.execute!({ agentType: 'explore', task: 'Explore', modelId }, { requestContext });
    expect(result).toMatchObject({ isError: false, content: 'Done.' });
    expect(requests.at(-1)?.model).toBe(expected);
  });
});
