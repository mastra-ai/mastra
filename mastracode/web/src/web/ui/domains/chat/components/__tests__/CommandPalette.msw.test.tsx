import type { AgentControllerSessionState, PermissionRules } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider } from '../../../workspaces';
import { CommandPalette, SLASH_COMMANDS } from '../../index';
import { ChatCommandsProvider, useChatCommands } from '../../context/ChatCommandsProvider';
import { ChatSessionProvider } from '../../context/ChatSessionProvider';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-command-palette';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-command-palette';

const project: Project = {
  id: 'project-command-palette',
  name: 'Command Palette Project',
  path: '/tmp/command-palette',
  resourceId: RESOURCE_ID,
  createdAt: 1,
};

function sessionState(): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function permissions(): PermissionRules {
  return { categories: {}, tools: {} };
}

function sse(): Response {
  return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

function useAgentControllerHandlers() {
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', name: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json(permissions())),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/stream`, () => sse()),
  );
}

function seedProject() {
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
}

function CommandProbe({ children }: { children: ReactNode }) {
  const { composerCommandName } = useChatCommands();

  return (
    <div>
      <span data-testid="composer-command-name">{composerCommandName ?? '(none)'}</span>
      {children}
    </div>
  );
}

function PaletteHarness() {
  const [open, setOpen] = useState(true);

  return (
    <ActiveProjectProvider>
      <ChatSessionProvider>
        <ChatCommandsProvider>
          <CommandProbe>
            <span data-testid="palette-state">{open ? 'open' : 'closed'}</span>
            {open && <CommandPalette onClose={() => setOpen(false)} />}
          </CommandProbe>
        </ChatCommandsProvider>
      </ChatSessionProvider>
    </ActiveProjectProvider>
  );
}

function renderPalette() {
  seedProject();
  useAgentControllerHandlers();
  return renderWithProviders(<PaletteHarness />);
}

afterEach(() => {
  localStorage.clear();
});

describe('CommandPalette', () => {
  describe('when it opens', () => {
    it('lists every slash command', () => {
      renderPalette();

      const list = screen.getByRole('listbox', { name: 'Commands' });
      expect(within(list).getAllByRole('option')).toHaveLength(SLASH_COMMANDS.length);
    });

    it('focuses the filter input', async () => {
      renderPalette();

      // The dialog applies initial focus asynchronously after its open animation.
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Filter commands' })).toHaveFocus());
    });
  });

  describe('when the user types a query', () => {
    it('filters to matching commands', async () => {
      const user = userEvent.setup();
      renderPalette();

      await user.type(screen.getByRole('textbox', { name: 'Filter commands' }), 'model');

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
      expect(options.length).toBeLessThan(SLASH_COMMANDS.length);
      expect(screen.getByText('/model')).toBeInTheDocument();
    });

    it('shows an empty state when nothing matches', async () => {
      const user = userEvent.setup();
      renderPalette();

      await user.type(screen.getByRole('textbox', { name: 'Filter commands' }), 'zzzznope');

      expect(screen.getByText('No matching commands')).toBeInTheDocument();
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });
  });

  describe('when a command is clicked', () => {
    it('runs it and closes', async () => {
      const user = userEvent.setup();
      renderPalette();

      await user.click(screen.getByText('/model'));

      expect(screen.getByTestId('composer-command-name')).toHaveTextContent('model');
      expect(screen.getByTestId('palette-state')).toHaveTextContent('closed');
    });
  });

  describe('when the user presses Enter', () => {
    it('runs the active command', async () => {
      const user = userEvent.setup();
      renderPalette();

      const input = screen.getByRole('textbox', { name: 'Filter commands' });
      await user.type(input, '{ArrowDown}{Enter}');

      expect(screen.getByTestId('composer-command-name')).toHaveTextContent(SLASH_COMMANDS[1].name);
      expect(screen.getByTestId('palette-state')).toHaveTextContent('closed');
    });
  });
});
