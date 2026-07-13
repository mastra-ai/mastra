#!/usr/bin/env node
import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const DELAY_MS = Number(process.env.DELAY_MS || 25);
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 48);
const LARGE_SIZE = Number(process.env.LARGE_SIZE || 60_000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
if (!Number.isFinite(DELAY_MS) || DELAY_MS < 0) {
  throw new Error('DELAY_MS must be a non-negative number');
}
if (!Number.isInteger(CHUNK_SIZE) || CHUNK_SIZE <= 0) {
  throw new Error('CHUNK_SIZE must be a positive integer');
}
if (!Number.isInteger(LARGE_SIZE) || LARGE_SIZE <= 0) {
  throw new Error('LARGE_SIZE must be a positive integer');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sse(res, value) {
  res.write(`data: ${JSON.stringify(value)}\n\n`);
}

function chunkString(value, size) {
  const chunks = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks;
}

function getMessageText(message) {
  return [message?.content]
    .flat()
    .map(part => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) return part.text;
      return '';
    })
    .join('\n');
}

function getPrompt(messages = []) {
  const latestUserMessage = [...messages].reverse().find(message => message?.role === 'user');
  return getMessageText(latestUserMessage ?? messages.at(-1)).toLowerCase();
}

function makeLargeTypeScriptContent(label) {
  const lines = [
    `type RenderSmokeRow = { id: number; label: string; enabled: boolean };`,
    `export const renderSmokeRows: RenderSmokeRow[] = [`,
  ];
  let size = lines.join('\n').length;
  for (let i = 0; size < LARGE_SIZE; i++) {
    const line = `  { id: ${i}, label: '${label}_${String(i).padStart(5, '0')}', enabled: ${i % 2 === 0} },`;
    lines.push(line);
    size += line.length + 1;
  }
  lines.push(`];`);
  lines.push(`export function getRenderSmokeLabel(id: number): string | undefined {`);
  lines.push(`  return renderSmokeRows.find(row => row.id === id)?.label;`);
  lines.push(`}`);
  return lines.join('\n');
}

function makeLargeCommand() {
  const parts = [`node -e "`];
  let size = parts.join('').length;
  for (let i = 0; size < LARGE_SIZE; i++) {
    const part = `console.log('ARG_STREAM_${String(i).padStart(5, '0')}');`;
    parts.push(part);
    size += part.length;
  }
  parts.push(`"`);
  return parts.join('');
}

function makeQuotedCommand() {
  const parts = [
    `if [ -f package.json ]; then echo "quoted if then fi ${'TEXT '.repeat(40)}" && printf 'single quoted && || ; ${'MORE '.repeat(40)}' || echo fallback; fi > /tmp/render-smoke-command.txt && node -e "`,
  ];
  let size = parts.join('').length;
  for (let i = 0; size < LARGE_SIZE; i++) {
    const part = `console.log('QUOTED_COMMAND_${String(i).padStart(5, '0')} && || if then fi');`;
    parts.push(part);
    size += part.length;
  }
  parts.push(`"`);
  return parts.join('');
}

async function streamToolCall(res, { id, toolName, args }) {
  const created = Math.floor(Date.now() / 1000);
  const callId = `call_${Math.random().toString(36).slice(2)}`;
  const argumentsJson = JSON.stringify(args);

  sse(res, {
    id,
    object: 'chat.completion.chunk',
    created,
    model: 'render-smoke',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [{ index: 0, id: callId, type: 'function', function: { name: toolName, arguments: '' } }],
        },
        finish_reason: null,
      },
    ],
  });

  for (const part of chunkString(argumentsJson, CHUNK_SIZE)) {
    sse(res, {
      id,
      object: 'chat.completion.chunk',
      created,
      model: 'render-smoke',
      choices: [
        { index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: part } }] }, finish_reason: null },
      ],
    });
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  sse(res, {
    id,
    object: 'chat.completion.chunk',
    created,
    model: 'render-smoke',
    choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
  });
  res.write('data: [DONE]\n\n');
}

async function streamText(res, text) {
  const id = `chatcmpl_${Math.random().toString(36).slice(2)}`;
  const created = Math.floor(Date.now() / 1000);
  sse(res, {
    id,
    object: 'chat.completion.chunk',
    created,
    model: 'render-smoke',
    choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
  });
  for (const part of chunkString(text, 80)) {
    sse(res, {
      id,
      object: 'chat.completion.chunk',
      created,
      model: 'render-smoke',
      choices: [{ index: 0, delta: { content: part }, finish_reason: null }],
    });
    await sleep(1);
  }
  sse(res, {
    id,
    object: 'chat.completion.chunk',
    created,
    model: 'render-smoke',
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  });
  res.write('data: [DONE]\n\n');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/v1/models' || req.url === '/models')) {
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        object: 'list',
        data: [{ id: 'render-smoke', object: 'model', created: 0, owned_by: 'local' }],
      }),
    );
    return;
  }

  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  const request = JSON.parse(body || '{}');
  const prompt = getPrompt(request.messages);

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  const id = `chatcmpl_${Math.random().toString(36).slice(2)}`;
  if (prompt.includes('write')) {
    await streamToolCall(res, {
      id,
      toolName: 'write_file',
      args: {
        path: 'tmp/render-smoke-large.ts',
        content: makeLargeTypeScriptContent('WRITE_STREAM'),
        overwrite: true,
      },
    });
  } else if (prompt.includes('edit')) {
    await streamToolCall(res, {
      id,
      toolName: 'string_replace_lsp',
      args: {
        path: 'tmp/render-smoke-large.ts',
        old_string: makeLargeTypeScriptContent('OLD_STREAM'),
        new_string: makeLargeTypeScriptContent('NEW_STREAM'),
      },
    });
  } else if (prompt.includes('quoted command') || prompt.includes('shell highlight')) {
    await streamToolCall(res, {
      id,
      toolName: 'execute_command',
      args: {
        command: makeQuotedCommand(),
        timeout: 30,
        cwd: null,
        tail: 200,
        background: false,
      },
    });
  } else if (prompt.includes('command') || prompt.includes('output')) {
    await streamToolCall(res, {
      id,
      toolName: 'execute_command',
      args: {
        command: makeLargeCommand(),
        timeout: 30,
        cwd: null,
        tail: 200,
        background: false,
      },
    });
  } else {
    await streamText(
      res,
      'Render Smoke ready. Send a prompt containing write, edit, command, quoted command, shell highlight, or output.',
    );
  }

  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mastra Code Render Smoke mock listening on http://localhost:${PORT}/v1`);
  console.log('Prompts: "write", "edit", "command output", or "quoted command"');
  console.log(`LARGE_SIZE=${LARGE_SIZE} CHUNK_SIZE=${CHUNK_SIZE} DELAY_MS=${DELAY_MS}`);
});
