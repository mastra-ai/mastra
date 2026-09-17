import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { mkdir, writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
const [serverPath, schemaPath, validatorDirectory, reportDirectory, shutdownMode = 'eof'] = process.argv.slice(2);
assert(['eof', 'SIGINT', 'SIGTERM'].includes(shutdownMode), 'Unknown shutdown mode');
if (!reportDirectory)
  throw new Error(
    'Usage: check-acp-conformance.mjs <server.mjs> <schema.json> <validator-directory> <report-directory> [eof|SIGINT|SIGTERM]',
  );
const require = createRequire(import.meta.url);
const validatorRequire = createRequire(resolve(validatorDirectory, 'package.json'));
const Ajv = validatorRequire('ajv/dist/2020.js').default;
const addFormats = validatorRequire('ajv-formats').default;
const schemaBytes = await readFile(schemaPath);
const schema = JSON.parse(schemaBytes);
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
for (const bits of [16, 32, 64])
  ajv.addFormat('uint' + bits, {
    type: 'number',
    validate: value => Number.isInteger(value) && value >= 0 && value < 2 ** bits,
  });
ajv.addSchema(schema, 'acp');
const validators = new Map();
const validate = (definition, value) => {
  let validator = validators.get(definition);
  if (!validator) {
    validator = ajv.compile({ $ref: 'acp#/$defs/' + definition });
    validators.set(definition, validator);
  }
  assert(validator(value), definition + ': ' + ajv.errorsText(validator.errors));
};
assert.throws(() => validate('PromptResponse', { stopReason: 'not-a-stop-reason' }));
assert.throws(() => validate('RequestPermissionRequest', {}));
const deadline = Promise.withResolvers();
const wireErrors = [],
  checks = [],
  pendingMethods = new Map();
let checkedMessages = 0;
const responseDefinitions = {
  initialize: 'InitializeResponse',
  'session/new': 'NewSessionResponse',
  'session/prompt': 'PromptResponse',
  'session/set_mode': 'SetSessionModeResponse',
  'session/set_model': 'SetSessionModelResponse',
  'session/set_config_option': 'SetSessionConfigOptionResponse',
};
function inspectWire(direction) {
  const decoder = new TextDecoder();
  let buffered = '';
  return new TransformStream({
    transform(chunk, controller) {
      buffered += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = buffered.indexOf('\n')) !== -1) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          assert.equal(message.jsonrpc, '2.0');
          if ('method' in message) {
            assert.equal(typeof message.method, 'string');
            assert(!('result' in message) && !('error' in message), 'Request mixed with response fields');
          } else {
            assert('result' in message !== 'error' in message, 'Response must contain exactly one of result/error');
            assert(!('params' in message), 'Response contains request params');
            validate('RequestId', message.id);
          }
          if (direction === 'client') {
            if (message.method && message.id !== undefined) pendingMethods.set(message.id, message.method);
          } else {
            if (message.method === 'session/update') {
              assert(!('id' in message));
              validate('SessionNotification', message.params);
            } else if (message.method === 'session/request_permission') {
              validate('RequestId', message.id);
              validate('RequestPermissionRequest', message.params);
            } else if ('error' in message) {
              assert(pendingMethods.has(message.id));
              validate('Error', message.error);
              pendingMethods.delete(message.id);
            } else if ('result' in message) {
              const method = pendingMethods.get(message.id);
              assert(method, 'Unmatched response');
              assert(responseDefinitions[method], 'Unexpected response method ' + method);
              validate(responseDefinitions[method], message.result);
              pendingMethods.delete(message.id);
            } else throw new Error('Unexpected agent message');
            checkedMessages++;
          }
        } catch (error) {
          wireErrors.push(error.message);
        }
      }
      controller.enqueue(chunk);
    },
    flush() {
      if (buffered.trim()) wireErrors.push('Incomplete JSON-RPC line at EOF');
    },
  });
}
const work = await mkdtemp(join(tmpdir(), 'mastra-acp-conformance-'));
const cwd = join(work, 'project');
await mkdir(cwd);
for (const [name, hidden] of [
  ['acp-review', false],
  ['acp-hidden', true],
]) {
  const directory = join(cwd, '.agents', 'skills', name);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ACP fixture skill\n${hidden ? 'user-invocable: false\n' : ''}---\n\nACP_SKILL_INSTRUCTIONS\n`,
  );
}
await mkdir(reportDirectory, { recursive: true });
const passed = name => {
  checks.push(name);
  console.log('PASS ' + name);
};
let modelMessages = [];
const mcpFixture = join(work, 'mcp.mjs');
const mcpPidFile = join(work, 'mcp-pids.jsonl');
await writeFile(mcpPidFile, '');
const readMcpPids = async () => (await readFile(mcpPidFile, 'utf8')).trim().split('\n').filter(Boolean).map(Number);
async function assertProcessesExited(pids) {
  for (const pid of pids) {
    const until = Date.now() + 2000;
    while (true) {
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code === 'ESRCH') break;
        throw error;
      }
      assert(Date.now() < until, `MCP child ${pid} survived runtime cleanup`);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
}

await writeFile(
  mcpFixture,
  `import readline from 'node:readline';
import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(mcpPidFile)}, String(process.pid)+'\\n');
for await (const line of readline.createInterface({input:process.stdin})) {
 const req=JSON.parse(line); if(req.id===undefined)continue; let result={};
 if(req.method==='initialize')result={protocolVersion:req.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};
 if(req.method==='tools/list')result={tools:[{name:'context',description:'Test cwd and environment',inputSchema:{type:'object',properties:{}}}]};
 if(req.method==='tools/call')result={content:[{type:'text',text:process.cwd()+' '+process.env.ACP_MCP_MARKER}]};
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,result})+'\\n');
}`,
);

let sseResponse;
const remoteRequests = [];
const remoteMcp = createServer((req, res) => {
  void (async () => {
    if (req.headers['x-acp-probe'] !== 'ACP_HEADER_OK') {
      res.writeHead(401);
      res.end();
      return;
    }
    if (req.method === 'GET' && req.url === '/sse') {
      sseResponse = res;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('event: endpoint\ndata: /messages\n\n');
      return;
    }
    if (req.method !== 'POST' || !['/http', '/messages'].includes(req.url)) {
      res.writeHead(405);
      res.end();
      return;
    }
    let body = '';
    for await (const part of req) body += part;
    const request = JSON.parse(body);
    const transport = req.url === '/http' ? 'http' : 'sse';
    remoteRequests.push({ transport, method: request.method });
    if (request.id === undefined) {
      res.writeHead(202);
      res.end();
      return;
    }
    let result = {};
    if (request.method === 'initialize')
      result = {
        protocolVersion: request.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: transport + '-fixture', version: '1' },
      };
    else if (request.method === 'tools/list')
      result = {
        tools: [
          {
            name: transport + '_context',
            description: 'Remote MCP probe',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      };
    else if (request.method === 'tools/call')
      result = { content: [{ type: 'text', text: transport + ' ACP_REMOTE_OK' }] };
    const reply = JSON.stringify({ jsonrpc: '2.0', id: request.id, result });
    if (transport === 'http') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(reply);
    } else {
      res.writeHead(202);
      res.end();
      sseResponse.write('event: message\ndata: ' + reply + '\n\n');
    }
  })().catch(error => {
    deadline.reject(error);
    res.destroy();
  });
});
await new Promise(resolve => remoteMcp.listen(0, '127.0.0.1', resolve));
const remoteMcpUrl = `http://127.0.0.1:${remoteMcp.address().port}`;

const { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } = await import(
  require.resolve('@agentclientprotocol/sdk')
);
let calls = 0;
let scenario = 'answer';
let requestedTool = false;
let permissionDecision = 'approve';
let permissionSeen;
let streamingSeen = Promise.withResolvers();
let streamingClosed = Promise.withResolvers();
let concurrentArrivals = 0;
const concurrentGate = Promise.withResolvers();
const http = createServer((req, res) => {
  void handleModel(req, res).catch(error => {
    deadline.reject(error);
    res.destroy();
  });
});
async function handleModel(req, res) {
  let body = '';
  for await (const data of req) body += data;
  const input = JSON.parse(body);
  calls++;
  modelMessages = input.messages;
  if (scenario === 'concurrent') {
    if (++concurrentArrivals === 2) concurrentGate.resolve();
    let timer;
    try {
      await Promise.race([
        concurrentGate.promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Model requests did not overlap')), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  if (scenario === 'error') {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'ACP_TEST_AUTH_FAILURE', type: 'authentication_error' } }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const common = { id: 'chatcmpl-acp-probe', object: 'chat.completion.chunk', created: 0, model: 'acp-test' };
  if (['write', 'deny', 'access', 'mcp', 'http-mcp', 'sse-mcp'].includes(scenario) && !requestedTool) {
    requestedTool = true;
    res.write(
      `data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: `probe-${scenario}-${calls}`, type: 'function', function: { name: scenario === 'access' ? 'request_access' : ['mcp', 'http-mcp', 'sse-mcp'].includes(scenario) ? input.tools.find(t => t.function.name.includes(scenario === 'http-mcp' ? 'http_context' : scenario === 'sse-mcp' ? 'sse_context' : 'context')).function.name : 'write_file', arguments: JSON.stringify(scenario === 'access' ? { path: join(work, 'outside'), reason: 'Test suspension' } : ['mcp', 'http-mcp', 'sse-mcp'].includes(scenario) ? {} : { path: scenario === 'deny' ? 'denied-probe.txt' : 'permission-probe.txt', content: 'ACP_WRITE_OK' }) } }] }, finish_reason: null }] })}\n\n`,
    );
    res.write(
      `data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })}\n\n`,
    );
    res.end('data: [DONE]\n\n');
    return;
  }
  res.write(
    `data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: { role: 'assistant', content: scenario === 'stream' ? 'ACP_STREAMING' : 'ACP_RUNTIME_OK' }, finish_reason: null }] })}\n\n`,
  );
  if (scenario === 'stream') {
    res.once('close', () => streamingClosed.resolve());
    return;
  }
  res.write(
    `data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: {}, finish_reason: scenario === 'length' ? 'length' : scenario === 'refusal' ? 'content_filter' : 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } })}\n\n`,
  );
  res.end('data: [DONE]\n\n');
}
await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
const dataDir = join(work, 'data');
await mkdir(dataDir, { recursive: true });
await writeFile(
  resolve(dataDir, 'settings.json'),
  JSON.stringify({
    customProviders: [
      {
        name: 'ACP Test',
        url: `http://127.0.0.1:${http.address().port}/v1`,
        apiKey: 'test-only',
        models: ['acp-test'],
      },
    ],
    models: {
      activeModelPackId: null,
      modeDefaults: { build: 'acp-test/acp-test', plan: 'acp-test/acp-test', fast: 'acp-test/acp-test' },
    },
    preferences: { subagentsEnabled: false },
  }),
);
const child = spawn(process.execPath, [resolve(serverPath)], {
  cwd: work,
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    HOME: join(work, 'home'),
    USERPROFILE: join(work, 'home'),
    XDG_CONFIG_HOME: join(work, 'config'),
    XDG_DATA_HOME: join(work, 'data'),
    MASTRA_APP_DATA_DIR: dataDir,
    NODE_OPTIONS: '--max-old-space-size=768',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});
const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
let stderr = '';
child.stderr.on('data', data => {
  stderr += data;
});
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
  http.closeAllConnections();
  http.close();
  remoteMcp.closeAllConnections();
  remoteMcp.close();
});
const updates = [];
const inspectClient = inspectWire('client');
const piping = inspectClient.readable.pipeTo(Writable.toWeb(child.stdin));
piping.catch(() => {});
const client = new ClientSideConnection(
  () => ({
    sessionUpdate: async update => {
      updates.push(update);
      if (update.update.sessionUpdate === 'agent_message_chunk' && update.update.content.text === 'ACP_STREAMING')
        streamingSeen.resolve();
    },
    requestPermission: async request => {
      if (permissionDecision !== 'wait' || request.options.some(option => option.name === 'Allow access'))
        permissionSeen?.();
      if (permissionDecision === 'wait' && request.options.some(option => option.name === 'Allow access'))
        return new Promise(() => {});
      return {
        outcome: {
          outcome: 'selected',
          optionId: request.options.find(
            option => option.kind === (permissionDecision !== 'reject' ? 'allow_once' : 'reject_once'),
          ).optionId,
        },
      };
    },
  }),
  ndJsonStream(inspectClient.writable, Readable.toWeb(child.stdout).pipeThrough(inspectWire('agent'))),
);
const timeout = setTimeout(() => {
  deadline.reject(new Error('Conformance run timed out'));
}, 90000);
async function runChecks() {
  const initialized = await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
  assert.equal(initialized.protocolVersion, 1);
  assert.equal(initialized.agentCapabilities.loadSession, false);
  passed('protocol v1 negotiation and declared capabilities');
  await assert.rejects(client.newSession({ cwd: 7, mcpServers: [] }), { code: -32602 });
  await assert.rejects(client.newSession({ cwd: 'relative', mcpServers: [] }), { code: -32602 });
  passed('invalid session parameters rejected');
  await assert.rejects(client.authenticate({ methodId: 'not-advertised' }), { code: -32602 });
  await assert.rejects(client.loadSession({ sessionId: 'missing', cwd, mcpServers: [] }), { code: -32601 });
  passed('unadvertised authentication and session loading rejected');

  const session = await client.newSession({
    cwd,
    mcpServers: [
      {
        name: 'probe',
        command: process.execPath,
        args: [mcpFixture],
        env: [{ name: 'ACP_MCP_MARKER', value: 'ACP_ENV_OK' }],
      },
      ...['http', 'sse'].map(type => ({
        name: type + '-probe',
        type,
        url: remoteMcpUrl + '/' + type,
        headers: [{ name: 'X-Acp-Probe', value: 'ACP_HEADER_OK' }],
      })),
    ],
  });
  const sessionId = session.sessionId;
  assert(sessionId);
  const commands = updates
    .filter(item => item.sessionId === sessionId && item.update.sessionUpdate === 'available_commands_update')
    .at(-1)?.update.availableCommands;
  assert(commands?.some(command => command.name === 'skill/acp-review'));
  assert(!commands.some(command => command.name === 'skill/acp-hidden'));
  await assert.rejects(client.prompt({ sessionId, prompt: [{ type: 'text', text: '/skill/acp-hidden' }] }), {
    code: -32602,
  });
  passed('workspace skill command discovery and hidden-skill rejection');
  await assert.rejects(client.prompt({ sessionId: 'missing', prompt: [] }), { code: -32602 });
  await assert.rejects(client.extMethod('_conformance_unknown', {}), { code: -32601 });
  passed('unknown session and method errors');
  for (const block of [
    { type: 'image', data: 'AA==', mimeType: 'image/png' },
    { type: 'audio', data: 'AA==', mimeType: 'audio/wav' },
    { type: 'resource', resource: { uri: 'file:///binary', blob: 'AA==' } },
  ])
    await assert.rejects(client.prompt({ sessionId, prompt: [block] }), { code: -32602 });
  passed('unsupported prompt content rejected without dropping attachments');

  const config = await client.setSessionConfigOption({ sessionId, configId: 'thought_level', value: 'high' });
  assert.equal(config.configOptions.find(option => option.id === 'thought_level').currentValue, 'high');
  for (const option of config.configOptions)
    if (option.type === 'select')
      assert(
        option.options.some(item => item.value === option.currentValue),
        option.id +
          ': currentValue ' +
          option.currentValue +
          ' is absent from options ' +
          JSON.stringify(option.options.slice(0, 3)),
      );
  await assert.rejects(client.setSessionConfigOption({ sessionId, configId: 'thought_level', value: 'invalid' }), {
    code: -32602,
  });
  await client.setSessionMode({ sessionId, modeId: 'plan' });
  await client.setSessionMode({ sessionId, modeId: 'build' });
  passed('configuration selection, invalid selection, and mode changes');
  const response = await client.prompt({ sessionId, prompt: [{ type: 'text', text: 'ACP_INPUT_MUST_NOT_BE_ECHOED' }] });
  assert.equal(response.stopReason, 'end_turn');
  assert.equal(
    updates
      .filter(x => x.update.sessionUpdate === 'agent_message_chunk')
      .map(x => x.update.content.text)
      .join(''),
    'ACP_RUNTIME_OK',
  );
  passed('assistant-only output and completed prompt');
  assert.equal(
    (await client.prompt({ sessionId, prompt: [{ type: 'text', text: '/skill/acp-review ACP_SKILL_ARGUMENT' }] }))
      .stopReason,
    'end_turn',
  );
  assert(
    modelMessages.some(
      message =>
        message.role === 'user' &&
        JSON.stringify(message.content).includes('ACP_SKILL_INSTRUCTIONS') &&
        JSON.stringify(message.content).includes('ACP_SKILL_ARGUMENT'),
    ),
  );
  passed('skill command expands workspace instructions and arguments into the model request');
  scenario = 'write';
  assert.equal(
    (await client.prompt({ sessionId, prompt: [{ type: 'text', text: 'Write the test file' }] })).stopReason,
    'end_turn',
  );
  assert.equal(await readFile(join(cwd, 'permission-probe.txt'), 'utf8'), 'ACP_WRITE_OK');
  assert(updates.some(x => x.update.sessionUpdate === 'tool_call'));
  assert(updates.some(x => x.update.sessionUpdate === 'tool_call_update' && x.update.status === 'completed'));
  passed('tool permission, lifecycle, and requested cwd');
  scenario = 'deny';
  requestedTool = false;
  permissionDecision = 'reject';
  assert.equal(
    (await client.prompt({ sessionId, prompt: [{ type: 'text', text: 'Deny this write' }] })).stopReason,
    'end_turn',
  );
  await assert.rejects(readFile(join(cwd, 'denied-probe.txt')), { code: 'ENOENT' });
  assert(modelMessages.some(message => message.role === 'tool'));
  passed('denied tool cannot write a file');

  scenario = 'stream';
  const streaming = client.prompt({ sessionId, prompt: [{ type: 'text', text: 'Stream until cancelled' }] });
  await streamingSeen.promise;
  await client.cancel({ sessionId });
  assert.equal((await streaming).stopReason, 'cancelled');
  await streamingClosed.promise;
  passed('streaming cancellation settles prompt and closes provider request');

  scenario = 'access';
  requestedTool = false;
  permissionDecision = 'wait';
  const seen = new Promise(resolve => (permissionSeen = resolve));
  const pending = client.prompt({ sessionId, prompt: [{ type: 'text', text: 'Request outside access' }] });
  await seen;
  await new Promise(resolve => setTimeout(resolve, 100));
  await client.cancel({ sessionId });
  await client.cancel({ sessionId });
  assert.equal((await pending).stopReason, 'cancelled');
  passed('suspended permission cancellation, including duplicate cancel');
  scenario = 'mcp';
  requestedTool = false;
  permissionDecision = 'approve';
  assert.equal(
    (await client.prompt({ sessionId, prompt: [{ type: 'text', text: 'Read MCP context' }] })).stopReason,
    'end_turn',
  );
  assert(modelMessages.some(m => m.role === 'tool' && m.content.includes(cwd + ' ACP_ENV_OK')));
  passed('follow-up turn and client MCP subprocess cwd/environment');
  for (const transport of ['http', 'sse']) {
    scenario = transport + '-mcp';
    requestedTool = false;
    assert.equal(
      (await client.prompt({ sessionId, prompt: [{ type: 'text', text: 'Call the remote MCP tool' }] })).stopReason,
      'end_turn',
    );
    assert(
      modelMessages.some(message => message.role === 'tool' && message.content.includes(transport + ' ACP_REMOTE_OK')),
    );
    assert(remoteRequests.some(request => request.transport === transport && request.method === 'tools/call'));
  }
  passed('HTTP and SSE MCP transports preserve headers and execute client tools');
  const existingPids = await readMcpPids();
  await assert.rejects(
    client.newSession({
      cwd,
      mcpServers: [
        { name: 'healthy', command: process.execPath, args: [mcpFixture], env: [] },
        { name: 'broken', command: join(work, 'missing-mcp-executable'), args: [], env: [] },
      ],
    }),
    error => error.code === -32603 && error.message.includes('broken'),
  );
  const failedSessionPids = (await readMcpPids()).filter(pid => !existingPids.includes(pid));
  assert(failedSessionPids.length > 0, 'The failed session must have started a real MCP child');
  await assertProcessesExited(failedSessionPids);
  passed('failed MCP initialization reports an error and terminates its started child');

  for (const [name, stopReason] of [
    ['length', 'max_tokens'],
    ['refusal', 'refusal'],
  ]) {
    scenario = name;
    assert.equal(
      (await client.prompt({ sessionId, prompt: [{ type: 'text', text: 'Test terminal finish reason' }] })).stopReason,
      stopReason,
    );
  }
  passed('provider token limit and refusal map to ACP stop reasons');
  scenario = 'error';
  await assert.rejects(
    client.prompt({ sessionId, prompt: [{ type: 'text', text: 'Trigger authentication failure' }] }),
    error => error.code === -32603 && error.message.includes('ACP_TEST_AUTH_FAILURE'),
  );
  passed('provider failures return JSON-RPC errors');
  scenario = 'answer';
  const secondCwd = join(work, 'second-project');
  await mkdir(secondCwd);
  const second = await client.newSession({ cwd: secondCwd, mcpServers: [] });
  assert.notEqual(second.sessionId, sessionId);
  await client.setSessionMode({ sessionId: second.sessionId, modeId: 'plan' });
  const firstConfig = await client.setSessionConfigOption({ sessionId, configId: 'thought_level', value: 'high' });
  assert.equal(firstConfig.configOptions.find(option => option.id === 'mode').currentValue, 'build');
  scenario = 'concurrent';
  const startUpdates = updates.length;
  const answers = await Promise.all(
    [sessionId, second.sessionId].map(id =>
      client.prompt({ sessionId: id, prompt: [{ type: 'text', text: 'Independent session answer' }] }),
    ),
  );
  assert(answers.every(answer => answer.stopReason === 'end_turn'));
  assert.equal(concurrentArrivals, 2);
  for (const id of [sessionId, second.sessionId])
    assert(
      updates
        .slice(startUpdates)
        .some(
          update =>
            update.sessionId === id &&
            update.update.sessionUpdate === 'agent_message_chunk' &&
            update.update.content.text === 'ACP_RUNTIME_OK',
        ),
    );

  assert(
    updates.some(
      update => update.sessionId === second.sessionId && update.update.sessionUpdate === 'agent_message_chunk',
    ),
  );
  passed('independent sessions, scoped configuration, and concurrent prompts');
  scenario = 'stream';
  streamingSeen = Promise.withResolvers();
  streamingClosed = Promise.withResolvers();
  const disconnected = client
    .prompt({ sessionId, prompt: [{ type: 'text', text: 'Disconnect during this turn' }] })
    .catch(error => error);
  await streamingSeen.promise;
  if (shutdownMode === 'eof') child.stdin.end();
  else child.kill(shutdownMode);
  const terminal = await disconnected;
  assert(terminal instanceof Error || terminal.stopReason === 'cancelled');
  await streamingClosed.promise;
  passed(`${shutdownMode} shutdown aborts an active provider stream`);
}
try {
  await Promise.race([runChecks(), deadline.promise]);
} catch (error) {
  console.error(error);
  wireErrors.push(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  child.stdin.end();
  let killTimer;
  const exit = await Promise.race([
    exited,
    new Promise(resolve => {
      killTimer = setTimeout(() => {
        wireErrors.push('Server required forced termination after stdin closed');
        child.kill('SIGKILL');
        resolve({ code: null, signal: 'SIGKILL' });
      }, 5000);
    }),
  ]);
  clearTimeout(killTimer);
  if (exit.code !== 0) wireErrors.push('Server exit: ' + JSON.stringify(exit));
  await client.closed;
  try {
    await assertProcessesExited(await readMcpPids());
    passed('shutdown terminates all started MCP child processes');
  } catch (error) {
    wireErrors.push(error.message);
  }
  if (!wireErrors.length) passed('all observed agent messages validate against the supplied upstream schema');
  else process.exitCode = 1;
  http.closeAllConnections();
  remoteMcp.closeAllConnections();
  await new Promise(resolve => remoteMcp.close(resolve));
  await new Promise(resolve => http.close(resolve));
  await writeFile(join(reportDirectory, 'stderr.log'), stderr);
  await writeFile(
    join(reportDirectory, 'report.json'),
    JSON.stringify(
      {
        protocol: 'Agent Client Protocol',
        testedAt: new Date().toISOString(),
        harnessSha256: createHash('sha256')
          .update(await readFile(new URL(import.meta.url)))
          .digest('hex'),
        protocolVersion: 1,
        shutdownMode,
        schemaSha256: createHash('sha256').update(schemaBytes).digest('hex'),
        serverSha256: createHash('sha256')
          .update(await readFile(serverPath))
          .digest('hex'),
        checkedMessages,
        checks,
        errors: wireErrors,
        limitations: [
          'Project-maintained checks, not upstream certification',
          'Deterministic model endpoint; live provider authentication not tested',
          'Optional session loading is not advertised or tested',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  await rm(work, { recursive: true, force: true });
}
