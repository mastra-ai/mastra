import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  generateSourceMap,
  indexDeclarationLines,
  parseModuleExports,
  SourceMapResolver,
} from './package-docs-source-map';

const MONOREPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function memoryResolver(files: Record<string, string>) {
  return new SourceMapResolver(file => files[file] ?? null);
}

describe('parseModuleExports', () => {
  it('keys `export { local as Public } from` by the public name', () => {
    const exports = parseModuleExports(
      'export { r as AISDKSpeech, t as CompositeVoice, Plain } from "../voice-BOIUIRc2.js";',
    );
    assert.deepEqual(exports, [
      { kind: 'reexport', name: 'AISDKSpeech', imported: 'r', source: '../voice-BOIUIRc2.js' },
      { kind: 'reexport', name: 'CompositeVoice', imported: 't', source: '../voice-BOIUIRc2.js' },
      { kind: 'reexport', name: 'Plain', imported: 'Plain', source: '../voice-BOIUIRc2.js' },
    ]);
  });

  it('resolves `export { Public }` through aliased and unaliased imports on multiple lines', () => {
    const exports = parseModuleExports(
      [
        'import { n as Agent, t as AGENT_RESUME_CLAIM_STALE_MS } from "../agent-DtdQ6un6.js";',
        'import {',
        '  l as TripWire,',
        '  MessageList',
        '} from "../stream-CqyUW6ex.js";',
        'import "../side-effect.js";',
        'export { AGENT_RESUME_CLAIM_STALE_MS, Agent, MessageList, TripWire };',
      ].join('\n'),
    );
    assert.deepEqual(exports, [
      { kind: 'reexport', name: 'AGENT_RESUME_CLAIM_STALE_MS', imported: 't', source: '../agent-DtdQ6un6.js' },
      { kind: 'reexport', name: 'Agent', imported: 'n', source: '../agent-DtdQ6un6.js' },
      { kind: 'reexport', name: 'MessageList', imported: 'MessageList', source: '../stream-CqyUW6ex.js' },
      { kind: 'reexport', name: 'TripWire', imported: 'l', source: '../stream-CqyUW6ex.js' },
    ]);
  });

  it('reports names declared in the file itself as local', () => {
    const exports = parseModuleExports(
      [
        'const MCP_SERVER_EVENT_ERROR_IDS = {};',
        'var Agent = class Agent {};',
        'export { MCP_SERVER_EVENT_ERROR_IDS, Agent as n };',
        'export function helper() {}',
      ].join('\n'),
    );
    assert.deepEqual(exports, [
      { kind: 'local', name: 'MCP_SERVER_EVENT_ERROR_IDS', local: 'MCP_SERVER_EVENT_ERROR_IDS' },
      { kind: 'local', name: 'n', local: 'Agent' },
      { kind: 'local', name: 'helper', local: 'helper' },
    ]);
  });

  it('records `export * from` and `export * as ns from` without inventing names', () => {
    const exports = parseModuleExports(
      ['export * from "@a2a-js/sdk-v0_3";', 'export * from "./local.js";', 'export * as utils from "./utils.js";'].join(
        '\n',
      ),
    );
    assert.deepEqual(exports, [
      { kind: 'star', source: '@a2a-js/sdk-v0_3' },
      { kind: 'star', source: './local.js' },
      { kind: 'reexport', name: 'utils', imported: '*', source: './utils.js' },
    ]);
  });

  it('skips type-only exports', () => {
    const exports = parseModuleExports(
      [
        'export type { OutputFormat } from "./message-list/index.js";',
        'export { type Config, Mastra } from "./mastra/index.js";',
      ].join('\n'),
    );
    assert.deepEqual(exports, [{ kind: 'reexport', name: 'Mastra', imported: 'Mastra', source: './mastra/index.js' }]);
  });
});

describe('indexDeclarationLines', () => {
  it('finds the declaration of the chunk identifier', () => {
    const lines = indexDeclarationLines(
      [
        'import { x } from "./x.js";',
        'var Agent = class Agent extends MastraBase {',
        '};',
        'async function embed$1() {}',
        'function createTool(opts) {}',
        'const LIMIT = 3;',
      ].join('\n'),
    );
    assert.equal(lines.get('Agent'), 2);
    assert.equal(lines.get('embed$1'), 4);
    assert.equal(lines.get('createTool'), 5);
    assert.equal(lines.get('LIMIT'), 6);
    assert.equal(lines.get('n'), undefined);
  });
});

describe('generateSourceMap', () => {
  it('maps public names to the declaring .d.ts and the declaration line in the chunk', () => {
    const root = '/pkg';
    const resolver = memoryResolver({
      '/pkg/dist/agent/index.js': [
        'import { n as Agent, t as helper } from "../agent-abc.js";',
        'import { r as Speech } from "../voice-def.js";',
        'export { Agent, Speech, helper };',
      ].join('\n'),
      '/pkg/dist/agent-abc.js': [
        'import { r as Speech } from "./voice-def.js";',
        'function helper() {}',
        'var Agent = class Agent {};',
        'export { Agent as n, helper as t };',
      ].join('\n'),
      '/pkg/dist/voice-def.js': ['var MastraVoice = class {};', 'export { MastraVoice as r };'].join('\n'),
      '/pkg/dist/agent/index.d.ts': [
        "export * from './agent.js';",
        "export { helper } from './utils.js';",
        "export { MastraVoice as Speech } from '../voice/index.js';",
      ].join('\n'),
      '/pkg/dist/agent/agent.d.ts': 'export declare class Agent {}',
      '/pkg/dist/agent/utils.d.ts': "import { helper } from './inner.js';\nexport { helper };",
      '/pkg/dist/agent/inner.d.ts': 'export declare function helper(): void;',
      '/pkg/dist/voice/index.d.ts': "export * from './voice.js';",
      '/pkg/dist/voice/voice.d.ts': 'export declare abstract class MastraVoice {}',
      '/pkg/dist/index.js': 'export { n as Agent } from "./agent-abc.js";\nexport * from "zod";',
      '/pkg/dist/index.d.ts': "export { Agent } from './agent/index.js';",
    });

    const map = generateSourceMap(root, { name: 'pkg', version: '1.0.0' }, ['agent', 'missing'], resolver);

    assert.deepEqual(map, {
      version: '1.0.0',
      package: 'pkg',
      exports: {
        Agent: { types: 'dist/agent/agent.d.ts', implementation: 'dist/agent-abc.js', line: 3 },
        Speech: { types: 'dist/voice/voice.d.ts', implementation: 'dist/voice-def.js', line: 1 },
        helper: { types: 'dist/agent/inner.d.ts', implementation: 'dist/agent-abc.js', line: 2 },
      },
      modules: {
        agent: { index: 'dist/agent/index.js', chunks: ['agent-abc.js', 'voice-def.js'] },
      },
    });
  });

  it('falls back to the module index.d.ts when the declaration cannot be traced', () => {
    const resolver = memoryResolver({
      '/pkg/dist/tools/index.js': 'export { t as createTool } from "../tool-x.js";',
      '/pkg/dist/tool-x.js': 'function createTool() {}\nexport { createTool as t };',
      '/pkg/dist/tools/index.d.ts': "export * from 'external-types';",
    });

    const map = generateSourceMap('/pkg', { name: 'pkg', version: '1.0.0' }, ['tools'], resolver);

    assert.deepEqual(map.exports.createTool, {
      types: 'dist/tools/index.d.ts',
      implementation: 'dist/tool-x.js',
      line: 1,
    });
  });

  it('leaves out bindings that a chunk re-exports from another package', () => {
    const resolver = memoryResolver({
      '/pkg/dist/index.js': 'export { n as MessageHistory, t as Memory } from "./src-abc.js";',
      '/pkg/dist/index.d.ts':
        'export declare class Memory {}\nexport { MessageHistory } from "@mastra/core/processors";',
      '/pkg/dist/src-abc.js': [
        'import { MessageHistory } from "@mastra/core/processors";',
        'class Memory {}',
        'export { Memory as t, MessageHistory as n };',
      ].join('\n'),
    });

    const map = generateSourceMap('/pkg', { name: 'pkg', version: '1.0.0' }, [], resolver);

    assert.deepEqual(Object.keys(map.exports), ['Memory']);
    assert.equal(map.exports.Memory?.line, 2);
  });

  it('leaves out bindings that reach the chunk through a star re-export from another package', () => {
    const resolver = memoryResolver({
      '/pkg/dist/index.js': 'export { MessageHistory, t as Memory } from "./src-abc.js";',
      '/pkg/dist/index.d.ts':
        'export declare class Memory {}\nexport { MessageHistory } from "@mastra/core/processors";',
      '/pkg/dist/src-abc.js': [
        'class Memory {}',
        'export { Memory as t };',
        'export * from "@mastra/core/processors";',
      ].join('\n'),
    });

    const map = generateSourceMap('/pkg', { name: 'pkg', version: '1.0.0' }, [], resolver);

    assert.deepEqual(Object.keys(map.exports), ['Memory']);
  });

  const coreRoot = path.join(MONOREPO_ROOT, 'packages/core');
  const coreBuilt = fs.existsSync(path.join(coreRoot, 'dist/agent/index.js'));

  it(
    'maps the main @mastra/core exports to files that exist',
    { skip: !coreBuilt && 'packages/core is not built' },
    () => {
      const packageJson = JSON.parse(fs.readFileSync(path.join(coreRoot, 'package.json'), 'utf-8'));
      const map = generateSourceMap(coreRoot, packageJson);

      for (const name of ['Agent', 'createTool', 'Mastra', 'createWorkflow', 'createStep']) {
        const info = map.exports[name];
        assert.ok(info, `${name} is missing from the source map`);
        assert.ok(fs.existsSync(path.join(coreRoot, info.types)), `${name} types ${info.types} does not exist`);
        const impl = path.join(coreRoot, info.implementation);
        assert.ok(fs.existsSync(impl), `${name} implementation ${info.implementation} does not exist`);
        assert.ok(info.line, `${name} has no line`);
        assert.match(fs.readFileSync(impl, 'utf-8').split('\n')[info.line - 1]!, new RegExp(`\\b${name}\\b`));
      }
      assert.equal(map.exports.Agent?.types, 'dist/agent/agent.d.ts');
    },
  );
});
