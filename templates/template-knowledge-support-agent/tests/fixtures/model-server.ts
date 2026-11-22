import { createServer } from 'node:http';
import { once } from 'node:events';

export interface ScriptedReply {
  content?: string;
  httpError?: { status: 503; message: string };
  tool?: { name: string; arguments: Record<string, unknown> };
}
export type ModelScript = (body: Record<string, unknown>) => ScriptedReply;

export function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(part => part?.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n');
}

export async function startModelServer(script?: ModelScript) {
  const requests: Record<string, unknown>[] = [];
  const failures: { status: number; message: string }[] = [];
  const server = createServer(async (request, response) => {
    let body: Record<string, unknown>;
    try {
      request.setEncoding('utf8');
      let raw = '';
      for await (const chunk of request) raw += chunk;
      body = JSON.parse(raw);
      if (
        !Array.isArray(body?.messages) ||
        !body.messages.every(message => message && typeof message === 'object' && typeof message.role === 'string')
      )
        throw new Error('Expected a messages array with valid roles');
    } catch (error) {
      if (!response.destroyed && !response.writableEnded && !request.aborted) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            error: {
              message: error instanceof Error ? error.message : 'Unable to read the model request',
              type: 'fixture_request_body',
            },
          }),
        );
      }
      return;
    }
    requests.push(body);
    const messages = body.messages as { role: string; content?: unknown; tool_calls?: unknown }[];
    const lastUserIndex = messages
      .map(message => message.role === 'user' && !messageText(message.content).startsWith('<pinned-knowledge'))
      .lastIndexOf(true);
    const hasTool = messages.slice(lastUserIndex + 1).some(message => message.role === 'tool');
    const read = /READ_PAGE:([^\s]+)/u.exec(messageText(messages[lastUserIndex]?.content));
    const toolMessages = messages.slice(lastUserIndex + 1).filter(message => message.role === 'tool');
    let requestedPage = read?.[1];
    if (!requestedPage && toolMessages.length === 1 && typeof toolMessages[0]?.content === 'string') {
      try {
        const search = JSON.parse(toolMessages[0].content);
        requestedPage = search.results?.find((result: { page?: { ref?: string } }) =>
          result.page?.ref?.includes('customer:'),
        )?.page?.ref;
      } catch {}
    }
    const shouldRead = !read && toolMessages.length === 1 && requestedPage;
    const toolCall = (name: string, args: Record<string, unknown>) => {
      const serialized = JSON.stringify(args);
      if (typeof serialized !== 'string') throw new Error('Model tool arguments must be JSON serializable');
      return { id: `fixture-call-${requests.length}`, type: 'function', function: { name, arguments: serialized } };
    };
    let scripted: ScriptedReply | undefined;
    let scriptedTool: ReturnType<typeof toolCall> | undefined;
    try {
      scripted = script?.(body);
      if (scripted?.tool && !scripted.httpError) scriptedTool = toolCall(scripted.tool.name, scripted.tool.arguments);
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : 'Scripted evidence assertion failed',
            type: 'fixture_assertion',
          },
        }),
      );
      return;
    }
    if (scripted?.httpError) {
      failures.push(scripted.httpError);
      response.writeHead(scripted.httpError.status, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ error: { message: scripted.httpError.message, type: 'synthetic_provider_failure' } }),
      );
      return;
    }
    const tool = script
      ? scriptedTool
      : !hasTool || shouldRead
        ? requestedPage
          ? toolCall('knowledge_read', { page: requestedPage })
          : toolCall('knowledge_search', { query: 'SYNTHETIC' })
        : undefined;
    const content = tool ? null : (scripted?.content ?? 'Synthetic evidence inspected. Local platform is ready.');
    if (body.stream) {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      const delta = tool ? { tool_calls: [{ index: 0, ...tool }] } : { content };
      response.write(
        `data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`,
      );
      response.write(
        `data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } })}\n\n`,
      );
      response.end('data: [DONE]\n\n');
    } else {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          id: 'fixture',
          object: 'chat.completion',
          created: 1,
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content, ...(tool ? { tool_calls: [tool] } : {}) },
              finish_reason: tool ? 'tool_calls' : 'stop',
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        }),
      );
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Model fixture failed to listen');
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    requests,
    failures,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

if (process.argv[1]?.endsWith('/model-server.ts')) {
  const model = await startModelServer();
  console.log(model.url);
}
