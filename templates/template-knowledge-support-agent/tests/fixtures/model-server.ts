import { createServer } from 'node:http';
import { once } from 'node:events';

export interface ScriptedReply {
  content?: string;
  httpError?: { status: 503; message: string };
  tool?: { name: string; arguments: Record<string, unknown> };
}
export type ModelScript = (body: Record<string, unknown>) => ScriptedReply;

export async function startModelServer(script?: ModelScript) {
  const requests: Record<string, unknown>[] = [];
  const failures: { status: number; message: string }[] = [];
  const server = createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    requests.push(body);
    const messages = body.messages as { role: string; content?: unknown; tool_calls?: unknown }[];
    const userText = (message: (typeof messages)[number]) =>
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    const lastUserIndex = messages
      .map(message => message.role === 'user' && !userText(message)?.startsWith('<pinned-knowledge'))
      .lastIndexOf(true);
    const hasTool = messages.slice(lastUserIndex + 1).some(message => message.role === 'tool');
    const text = messages[lastUserIndex] ? userText(messages[lastUserIndex]!) : '';
    const read = /READ_PAGE:([^\s]+)/u.exec(text ?? '');
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
    let scripted: ScriptedReply | undefined;
    try {
      scripted = script?.(body);
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
    const tool = scripted?.tool
      ? {
          id: `fixture-call-${requests.length}`,
          type: 'function',
          function: { name: scripted.tool.name, arguments: JSON.stringify(scripted.tool.arguments) },
        }
      : script
        ? undefined
        : !hasTool || shouldRead
          ? {
              id: `fixture-call-${requests.length}`,
              type: 'function',
              function: {
                name: requestedPage ? 'knowledge_read' : 'knowledge_search',
                arguments: JSON.stringify(requestedPage ? { page: requestedPage } : { query: 'SYNTHETIC' }),
              },
            }
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
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

if (process.argv[1]?.endsWith('/model-server.ts')) {
  const model = await startModelServer();
  console.log(model.url);
}
