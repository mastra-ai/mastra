import { describe, expect, it } from 'vitest';

import { WORKSPACE_TOOLS } from '../../workspace/constants';

import {
  classifyHarnessWorkspaceToolAction,
  getHarnessWorkspaceActionPathInput,
  isHarnessWorkspaceFileMutationTool,
} from './workspace-actions';

describe('Harness v1 workspace action taxonomy', () => {
  const pathFor = (inputPath: string) => ({ inputPath });

  it('classifies canonical filesystem tool ids', () => {
    expect(
      classifyHarnessWorkspaceToolAction(
        WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
        { path: 'src/index.ts', content: 'export {};' },
        { pathFor },
      ),
    ).toMatchObject({
      actionKind: 'file',
      operation: 'write',
      mutatesWorkspace: true,
      pathInput: 'src/index.ts',
      path: { inputPath: 'src/index.ts' },
      action: {
        kind: 'file',
        operation: 'write',
        toolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
        canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
      },
    });

    expect(
      classifyHarnessWorkspaceToolAction(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE, { path: 'src/index.ts' }, { pathFor }),
    ).toMatchObject({
      actionKind: 'file',
      operation: 'patch',
      mutatesWorkspace: true,
      pathInput: 'src/index.ts',
    });
  });

  it('classifies MC remapped workspace aliases through the same taxonomy', () => {
    expect(classifyHarnessWorkspaceToolAction('write_file', { path: 'src/app.ts' }, { pathFor })).toMatchObject({
      actionKind: 'file',
      operation: 'write',
      mutatesWorkspace: true,
      action: {
        toolName: 'write_file',
        canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
      },
    });
    expect(classifyHarnessWorkspaceToolAction('string_replace_lsp', { path: 'src/app.ts' }, { pathFor })).toMatchObject(
      {
        actionKind: 'file',
        operation: 'patch',
        mutatesWorkspace: true,
        action: {
          toolName: 'string_replace_lsp',
          canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
        },
      },
    );
    expect(classifyHarnessWorkspaceToolAction('ast_smart_edit', { path: 'src/app.ts' }, { pathFor })).toMatchObject({
      actionKind: 'file',
      operation: 'patch',
      mutatesWorkspace: true,
      action: {
        toolName: 'ast_smart_edit',
        canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT,
      },
    });
  });

  it('classifies configured workspace remaps without knowing the alias in advance', () => {
    expect(
      classifyHarnessWorkspaceToolAction(
        'replace_text',
        { path: 'src/app.ts' },
        {
          pathFor,
          toolNameConfig: {
            [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { name: 'replace_text' },
          },
        },
      ),
    ).toMatchObject({
      actionKind: 'file',
      operation: 'patch',
      mutatesWorkspace: true,
      action: {
        toolName: 'replace_text',
        canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
      },
    });
  });

  it('defaults list and grep read scopes to the workspace root', () => {
    expect(classifyHarnessWorkspaceToolAction('find_files', {}, { pathFor })).toMatchObject({
      actionKind: 'file',
      operation: 'read',
      mutatesWorkspace: false,
      pathInput: '.',
      path: { inputPath: '.' },
    });
    expect(classifyHarnessWorkspaceToolAction('search_content', { pattern: 'TODO' }, { pathFor })).toMatchObject({
      actionKind: 'file',
      operation: 'read',
      mutatesWorkspace: false,
      pathInput: '.',
      path: { inputPath: '.' },
    });
  });

  it('classifies command and process tools without file paths', () => {
    expect(
      classifyHarnessWorkspaceToolAction(
        'execute_command',
        { command: 'pnpm test', cwd: 'packages/core' },
        { pathFor },
      ),
    ).toMatchObject({
      actionKind: 'command',
      operation: 'execute',
      mutatesWorkspace: true,
      cwdInput: 'packages/core',
      cwd: { inputPath: 'packages/core' },
      action: {
        kind: 'command',
        command: 'pnpm test',
        canonicalToolName: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
      },
    });
    expect(classifyHarnessWorkspaceToolAction('get_process_output', { pid: '42' })).toMatchObject({
      actionKind: 'command',
      operation: 'read_output',
      mutatesWorkspace: false,
    });
    expect(classifyHarnessWorkspaceToolAction('kill_process', { pid: '42' })).toMatchObject({
      actionKind: 'command',
      operation: 'kill',
      mutatesWorkspace: true,
    });
  });

  it('exposes mutation and path helpers for compatibility UIs', () => {
    expect(isHarnessWorkspaceFileMutationTool('write_file')).toBe(true);
    expect(isHarnessWorkspaceFileMutationTool('string_replace_lsp')).toBe(true);
    expect(isHarnessWorkspaceFileMutationTool('view')).toBe(false);
    expect(isHarnessWorkspaceFileMutationTool('execute_command')).toBe(false);
    expect(getHarnessWorkspaceActionPathInput('write_file', { path: 'src/app.ts' })).toBe('src/app.ts');
    expect(getHarnessWorkspaceActionPathInput('write_file', { path: '' })).toBeUndefined();
  });

  it('does not classify unknown tools or missing required paths', () => {
    expect(classifyHarnessWorkspaceToolAction('custom_tool', {})).toBeUndefined();
    expect(classifyHarnessWorkspaceToolAction('write_file', {})).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // MCP classification
  // -------------------------------------------------------------------------

  describe('MCP namespace match', () => {
    it('classifies <serverKey>_<toolName> as actionKind: "mcp"', () => {
      const result = classifyHarnessWorkspaceToolAction(
        'weather_getForecast',
        { city: 'Paris' },
        { mcpServerKeys: ['weather'] },
      );
      expect(result).toMatchObject({
        actionKind: 'mcp',
        operation: 'call',
        mutatesWorkspace: false,
        action: {
          kind: 'mcp',
          serverId: 'weather',
          toolName: 'getForecast',
          canonicalToolName: 'getForecast',
        },
      });
    });

    it('prefers the longest-prefix match when keys overlap', () => {
      const result = classifyHarnessWorkspaceToolAction(
        'weather_eu_getForecast',
        {},
        { mcpServerKeys: ['weather', 'weather_eu'] },
      );
      expect(result?.action).toMatchObject({
        serverId: 'weather_eu',
        toolName: 'getForecast',
      });
    });

    it('returns undefined when no MCP key matches', () => {
      const result = classifyHarnessWorkspaceToolAction('unrelated_tool', {}, { mcpServerKeys: ['weather'] });
      expect(result).toBeUndefined();
    });

    it('does not classify when the suffix after the underscore is empty', () => {
      const result = classifyHarnessWorkspaceToolAction('weather_', {}, { mcpServerKeys: ['weather'] });
      expect(result).toBeUndefined();
    });

    it('ignores empty / non-string entries in mcpServerKeys defensively', () => {
      const result = classifyHarnessWorkspaceToolAction(
        'weather_getForecast',
        {},
        // Mixed-content list — only valid keys are considered.
        { mcpServerKeys: ['', 'weather', null as unknown as string] },
      );
      expect(result?.actionKind).toBe('mcp');
    });
  });

  // -------------------------------------------------------------------------
  // Network classification via top-level URL field
  // -------------------------------------------------------------------------

  describe('network URL detection', () => {
    it('classifies a tool call with `url` arg as actionKind: "network"', () => {
      const result = classifyHarnessWorkspaceToolAction('http_fetch', {
        url: 'https://api.example.com:8443/v1/widgets',
      });
      expect(result).toMatchObject({
        actionKind: 'network',
        operation: 'request',
        mutatesWorkspace: false,
        action: {
          kind: 'network',
          toolName: 'http_fetch',
          canonicalToolName: 'http_fetch',
          host: 'api.example.com',
          port: 8443,
          protocol: 'https',
          url: 'https://api.example.com:8443/v1/widgets',
        },
      });
    });

    it('recognizes `endpoint` and `uri` as aliases for `url`', () => {
      expect(
        classifyHarnessWorkspaceToolAction('rest_call', { endpoint: 'https://api.example.com/v1' })?.actionKind,
      ).toBe('network');
      expect(classifyHarnessWorkspaceToolAction('soap_call', { uri: 'http://api.example.com/soap' })?.actionKind).toBe(
        'network',
      );
    });

    it('fills in default ports for http/https/ws/wss when the URL omits the port', () => {
      const http = classifyHarnessWorkspaceToolAction('http_get', { url: 'http://example.com/' });
      expect(http?.action).toMatchObject({ host: 'example.com', port: 80, protocol: 'http' });
      const https = classifyHarnessWorkspaceToolAction('https_get', { url: 'https://example.com/' });
      expect(https?.action).toMatchObject({ host: 'example.com', port: 443, protocol: 'https' });
    });

    it('captures the HTTP method from args.method when provided as a string', () => {
      const result = classifyHarnessWorkspaceToolAction('http_call', {
        url: 'https://example.com/v1',
        method: 'post',
      });
      expect(result?.operation).toBe('POST');
      expect(result?.action).toMatchObject({ method: 'POST', operation: 'POST' });
    });

    it('returns undefined when the url value is not a string', () => {
      const result = classifyHarnessWorkspaceToolAction('http_call', { url: 42 });
      expect(result).toBeUndefined();
    });

    it('returns undefined when the url string is not parseable', () => {
      const result = classifyHarnessWorkspaceToolAction('http_call', { url: 'not a url at all' });
      expect(result).toBeUndefined();
    });

    it('rejects non-network URI schemes (file/data/mailto/blob) so they do not pollute the journal', () => {
      // `new URL()` accepts these; the classifier must NOT mark them as
      // network actions because the host/port/protocol payload is
      // meaningless for them. Regression for the codex review finding.
      expect(classifyHarnessWorkspaceToolAction('read_local', { url: 'file:///tmp/example' })).toBeUndefined();
      expect(
        classifyHarnessWorkspaceToolAction('inline_data', { url: 'data:text/plain;base64,SGVsbG8=' }),
      ).toBeUndefined();
      expect(classifyHarnessWorkspaceToolAction('email', { url: 'mailto:user@example.com' })).toBeUndefined();
      expect(classifyHarnessWorkspaceToolAction('blob_open', { url: 'blob:https://example.com/abc' })).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Classifier precedence
  // -------------------------------------------------------------------------

  describe('classifier precedence', () => {
    it('static file/command descriptors win over MCP namespace matches', () => {
      // The static `write_file` descriptor must keep its `'file'` kind even
      // if `write` happens to also be a registered MCP server key.
      const result = classifyHarnessWorkspaceToolAction(
        'write_file',
        { path: 'src/app.ts' },
        { mcpServerKeys: ['write'] },
      );
      expect(result?.actionKind).toBe('file');
    });

    it('MCP match wins over a url field in args', () => {
      // A tool whose name matches an MCP namespace AND whose args contain
      // a URL classifies as MCP, not network.
      const result = classifyHarnessWorkspaceToolAction(
        'weather_getByLocation',
        { url: 'https://example.com/' },
        { mcpServerKeys: ['weather'] },
      );
      expect(result?.actionKind).toBe('mcp');
    });
  });
});
