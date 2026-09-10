// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FileTreeMessage } from '../file-tree-message';
import { SandboxExecutionMessage } from '../sandbox-execution-message';

afterEach(cleanup);

describe('Workspace messages', () => {
  describe('when a directory listing is complete', () => {
    it('reveals the original tree without application providers', () => {
      render(
        <FileTreeMessage
          toolName="mastra_workspace_list_files"
          toolCallId="files"
          args={{ path: 'src' }}
          result={'src\n  index.ts\n\n1 file'}
          isRunning={false}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /List Files/ }));
      expect(screen.getByText(/index.ts/)).toBeTruthy();
    });
  });
  describe('when a command completes', () => {
    it('renders the command output without application providers', () => {
      render(
        <SandboxExecutionMessage
          toolName="mastra_workspace_execute_command"
          toolCallId="command"
          args={{ command: 'echo hello' }}
          result="hello"
          isRunning={false}
        />,
      );
      expect(screen.getByText('hello')).toBeTruthy();
    });
  });
});
