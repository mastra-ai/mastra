import { describe, expect, it } from 'vitest';

import { ToolsIcon } from '../../../icons/ToolsIcon';
import { presentTool } from './tool-presentation';

describe('presentTool', () => {
  it('maps stable workspace aliases to humanized actions with their salient argument', () => {
    expect(presentTool('view', { path: 'src/a.ts' })).toMatchObject({ label: 'Read', detail: 'src/a.ts' });
    expect(presentTool('search_content', { pattern: 'useChat' })).toMatchObject({
      label: 'Search',
      detail: 'useChat',
    });
    expect(presentTool('string_replace', { path: 'src/a.ts' })).toMatchObject({
      label: 'Edit',
      detail: 'src/a.ts',
    });
  });

  it('marks terminal-style tools with their command for the expanded body', () => {
    expect(presentTool('execute_command', { command: 'pnpm test' })).toMatchObject({
      label: 'Run',
      detail: 'pnpm test',
      command: 'pnpm test',
    });
  });

  it('keeps the cd preamble out of the row but inside the command', () => {
    const command = "cd '/Users/me/work spaces/repo' && pnpm build";
    expect(presentTool('execute_command', { command })).toMatchObject({
      detail: 'pnpm build',
      command,
    });
  });

  it('strips an unquoted cd preamble too', () => {
    const command = 'cd packages/core && pnpm build';
    expect(presentTool('execute_command', { command })).toMatchObject({ detail: 'pnpm build', command });
  });

  it('leaves a bare cd alone because it is the whole command', () => {
    expect(presentTool('execute_command', { command: 'cd packages/core' })).toMatchObject({
      detail: 'cd packages/core',
    });
  });

  it('strips the raw workspace prefix before lookup', () => {
    expect(presentTool('mastra_workspace_read_file', { path: 'a.ts' })).toMatchObject({
      label: 'Read',
      detail: 'a.ts',
    });
  });

  it('prettifies unknown tool names instead of surfacing raw identifiers', () => {
    expect(presentTool('fetch_pull_request', undefined)).toMatchObject({
      icon: ToolsIcon,
      label: 'Fetch pull request',
    });
  });

  it('omits the detail when the salient argument has not streamed yet', () => {
    expect(presentTool('execute_command', undefined).detail).toBeUndefined();
  });
});
