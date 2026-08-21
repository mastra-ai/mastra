import { describe, expect, it } from 'vitest';

import { presentTool } from './tool-presentation';

describe('presentTool', () => {
  it('maps stable workspace aliases to humanized actions with their salient argument', () => {
    expect(presentTool({ toolName: 'view', args: { path: 'src/a.ts' } })).toMatchObject({
      label: 'Read',
      detail: 'src/a.ts',
    });
    expect(presentTool({ toolName: 'search_content', args: { pattern: 'useChat' } })).toMatchObject({
      label: 'Search',
      detail: 'useChat',
    });
    expect(presentTool({ toolName: 'string_replace', args: { path: 'src/a.ts' } })).toMatchObject({
      label: 'Edit',
      detail: 'src/a.ts',
    });
  });

  it('marks terminal-style tools with their command for the expanded body', () => {
    expect(presentTool({ toolName: 'execute_command', args: { command: 'pnpm test' } })).toMatchObject({
      label: 'Run',
      detail: 'pnpm test',
      command: 'pnpm test',
    });
  });

  it('keeps the cd preamble out of the row but inside the command', () => {
    const cd = "cd '/Users/me/work spaces/repo' && pnpm build";
    expect(presentTool({ toolName: 'execute_command', args: { command: cd } })).toMatchObject({
      detail: 'pnpm build',
      command: cd,
    });
  });

  it('strips an unquoted cd preamble too', () => {
    const cd = 'cd packages/core && pnpm build';
    expect(presentTool({ toolName: 'execute_command', args: { command: cd } })).toMatchObject({
      detail: 'pnpm build',
      command: cd,
    });
  });

  it('leaves a bare cd alone — it is the whole command', () => {
    expect(presentTool({ toolName: 'execute_command', args: { command: 'cd packages/core' } })).toMatchObject({
      detail: 'cd packages/core',
    });
  });

  it('strips the raw workspace prefix before lookup', () => {
    expect(presentTool({ toolName: 'mastra_workspace_read_file', args: { path: 'a.ts' } })).toMatchObject({
      label: 'Read',
      detail: 'a.ts',
    });
  });

  it('prettifies unknown tool names instead of surfacing raw identifiers', () => {
    expect(presentTool({ toolName: 'fetch_pull_request' }).label).toBe('Fetch pull request');
  });

  it('omits the detail when the salient argument has not streamed yet', () => {
    expect(presentTool({ toolName: 'execute_command' }).detail).toBeUndefined();
  });

  it('reads a provider-run web search out of its result, since its input is always empty', () => {
    expect(
      presentTool({ toolName: 'web_search', args: {}, result: { action: { type: 'search', query: 'mastra' } } }),
    ).toMatchObject({ label: 'Search the web', detail: 'mastra' });
  });

  it('names the web action the model actually took', () => {
    const url = 'https://github.com/mastra-ai/mastra/pull/21870';
    expect(
      presentTool({ toolName: 'web_search', args: {}, result: { action: { type: 'openPage', url } } }),
    ).toMatchObject({ label: 'Open page', detail: url });
    expect(
      presentTool({
        toolName: 'web_search',
        args: {},
        result: { action: { type: 'findInPage', url, pattern: 'loop' } },
      }),
    ).toMatchObject({ label: 'Find in page', detail: 'loop' });
  });

  it('prefers the query a self-reporting provider sends as input', () => {
    expect(presentTool({ toolName: 'web_search', args: { query: 'mastra docs' }, result: [] })).toMatchObject({
      label: 'Search the web',
      detail: 'mastra docs',
    });
  });
});
