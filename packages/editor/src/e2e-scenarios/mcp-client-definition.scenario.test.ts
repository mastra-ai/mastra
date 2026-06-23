import { describe, expect, it } from 'vitest';
import { EditorMCPNamespace } from '../namespaces/mcp';
import { createEditorScenarioMastra } from './editor-scenario-utils';

describe('Editor E2E scenario: MCP client configuration', () => {
  it('persists an MCP client and converts stored server configs into runtime client options', async () => {
    // USER STORY: A Studio user saves MCP server settings and expects runtime MCP clients to use them.
    // ARRANGE: Persist a stored MCP client with both stdio and HTTP server definitions.
    const { editor } = createEditorScenarioMastra();
    const storedClient = await editor.mcp.create({
      id: 'docs-mcp',
      name: 'Docs MCP',
      servers: {
        localDocs: {
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { DOCS_ROOT: '/repo/docs' },
          timeout: 1500,
        },
        remoteDocs: {
          type: 'http',
          url: 'https://mcp.example.test/sse',
          timeout: 2500,
        },
      },
    });

    // ACT: Convert the stored config through the same namespace utility used for runtime hydration.
    const options = EditorMCPNamespace.toMCPClientOptions(storedClient, {
      headers: { Authorization: 'Bearer token' },
    });

    // ASSERT: Runtime options preserve command/env and HTTP URL plus runtime request headers.
    expect(options.id).toBe('docs-mcp');
    expect(options.servers.localDocs).toMatchObject({
      command: 'node',
      args: ['server.js'],
      env: { DOCS_ROOT: '/repo/docs' },
      timeout: 1500,
    });
    expect(options.servers.remoteDocs).toMatchObject({
      url: new URL('https://mcp.example.test/sse'),
      timeout: 2500,
      requestInit: { headers: { Authorization: 'Bearer token' } },
    });
  });
});
