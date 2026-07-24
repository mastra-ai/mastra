/**
 * BDD coverage for `ActiveModel`, the status-line model indicator below the
 * composer. While the agent connection is still resolving there is no model id
 * yet, so the component must show a loading skeleton instead of a misleading
 * "No model" label; once connected it renders the formatted model name and
 * flags models whose provider has no usable credentials.
 */
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

import { server } from '../../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../../e2e/web-ui/render';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import type { ChatConnectionApi } from '../../../context/ChatConnectionContext';
import { ChatModelsContext } from '../../../context/ChatModelsContext';
import { ActiveModel } from '../ActiveModel';

function renderActiveModel({
  activeModelId,
  status,
  activeThreadId = 'thread-a',
  routeThreadId = 'thread-a',
}: {
  activeModelId: string | undefined;
  status: ChatConnectionApi['status'];
  activeThreadId?: string;
  routeThreadId?: string;
}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${routeThreadId}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ChatConnectionContext.Provider value={{ status, threadId: activeThreadId }}>
              <ChatModelsContext.Provider value={{ activeModelId, setModel: () => Promise.resolve() }}>
                <ActiveModel />
              </ChatModelsContext.Provider>
            </ChatConnectionContext.Provider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function stubModelCatalog(ids: string[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: ids.map(id => ({ id, provider: id.split('/')[0], modelName: id, hasApiKey: true })),
      }),
    ),
  );
}

describe('ActiveModel', () => {
  describe('given the connection is still resolving and no model id is known yet', () => {
    it('shows a loading skeleton instead of a "No model" label', () => {
      renderActiveModel({ activeModelId: undefined, status: 'connecting' });

      expect(screen.getByLabelText('Loading model')).toBeInTheDocument();
      expect(screen.queryByText('No model')).not.toBeInTheDocument();
    });
  });

  describe('given the route changed before the controller bound the new thread', () => {
    it("does not label the new conversation with the previous thread's model", () => {
      renderActiveModel({
        activeModelId: 'anthropic/claude-opus-4-8',
        status: 'ready',
        activeThreadId: 'thread-a',
        routeThreadId: 'thread-b',
      });

      expect(screen.getByLabelText('Loading model')).toBeInTheDocument();
      expect(screen.queryByText('Claude Opus 4.8')).not.toBeInTheDocument();
    });
  });

  describe('given the connection is ready but reports no model', () => {
    it('falls back to the explicit "No model" label', () => {
      renderActiveModel({ activeModelId: undefined, status: 'ready' });

      expect(screen.getByText('No model')).toBeInTheDocument();
      expect(screen.queryByLabelText('Loading model')).not.toBeInTheDocument();
    });
  });

  describe('given a connected session with a credentialed model', () => {
    it('renders the formatted model name without a warning', async () => {
      stubModelCatalog(['anthropic/claude-sonnet-4-5']);
      renderActiveModel({ activeModelId: 'anthropic/claude-sonnet-4-5', status: 'ready' });

      expect(await screen.findByText('Claude Sonnet 4.5')).toBeInTheDocument();
      expect(screen.queryByText(/not configured/)).not.toBeInTheDocument();
    });
  });

  describe('given the active model is missing from the credentialed catalog', () => {
    it('flags the model as not configured', async () => {
      stubModelCatalog(['openai/gpt-5']);
      renderActiveModel({ activeModelId: 'anthropic/claude-sonnet-4-5', status: 'ready' });

      expect(await screen.findByLabelText('Claude Sonnet 4.5 is not configured')).toBeInTheDocument();
    });
  });
});
