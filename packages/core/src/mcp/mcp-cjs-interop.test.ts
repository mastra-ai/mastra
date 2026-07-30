import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MCPServerBase } from '.';
import type { MCPServerConfig } from '.';

class MockMCPServer extends MCPServerBase {
  constructor(config: MCPServerConfig) {
    super(config);
  }

  convertTools(_tools: any) {
    return {};
  }
  async startStdio() {}
  async startSSE() {}
  async startHonoSSE() {
    return undefined;
  }
  async startHTTP() {}
  async close() {}
  getServerInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      repository: this.repository,
      version_detail: {
        version: this.version,
        release_date: this.releaseDate,
        is_latest: this.isLatest,
      },
    };
  }
  getServerDetail() {
    return {
      ...this.getServerInfo(),
      package_canonical: this.packageCanonical,
      packages: this.packages,
      remotes: this.remotes,
    };
  }
  getToolListInfo() {
    return { tools: [] };
  }
  getToolInfo() {
    return undefined;
  }
  async executeTool() {
    return {};
  }
  async readResource() {
    return { contents: [] };
  }
  async listResources() {
    return { resources: [] };
  }
}

describe('MCPServerBase id slugification', () => {
  it('slugifies a caller-supplied id', () => {
    const server = new MockMCPServer({ id: 'My Server ID', name: 'test', version: '1.0.0', tools: {} });
    expect(server.id).toBe('my-server-id');
  });

  it('falls back to a generated id when none is supplied', () => {
    const server = new MockMCPServer({ name: 'test', version: '1.0.0', tools: {} });
    expect(server.id).toBeTruthy();
  });
});

const distEntry = join(dirname(fileURLToPath(import.meta.url)), '../../dist/mcp/index.cjs');

/**
 * Guards the CommonJS consumption path: `@mastra/core` is bundled to both ESM
 * and CJS, and only the CJS output goes through the rolldown `__toESM` interop
 * bridge that broke `slugify` in 1.54.0. Requires the package to be built, so
 * it is skipped when `dist/` is absent.
 */
describe.skipIf(!existsSync(distEntry))('MCPServerBase under require()', () => {
  it('constructs and slugifies its id from the built CJS bundle', () => {
    const script = `
      const { MCPServerBase } = require(${JSON.stringify(distEntry)});
      class S extends MCPServerBase {
        convertTools() { return {}; }
        async startStdio() {}
        async startSSE() {}
        async startHonoSSE() {}
        async startHTTP() {}
        async close() {}
        getServerInfo() { return {}; }
        getServerDetail() { return {}; }
        getToolListInfo() { return { tools: [] }; }
        getToolInfo() { return undefined; }
        async executeTool() { return {}; }
        async readResource() { return { contents: [] }; }
        async listResources() { return { resources: [] }; }
      }
      process.stdout.write(new S({ id: 'My Server ID', name: 'test', version: '1.0.0', tools: {} }).id);
    `;

    const require = createRequire(import.meta.url);
    const output = execFileSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      cwd: dirname(require.resolve('../../package.json')),
    });

    expect(output).toBe('my-server-id');
  });
});
