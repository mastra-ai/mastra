import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/ui/render';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import type { ChatConnectionApi } from '../../../context/ChatConnectionContext';
import { ChatModelsContext } from '../../../context/ChatModelsContext';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { ActiveModel } from '../ActiveModel';

const factorySession: ChatSessionContextApi = {
  resourceId: 'session-1',
  sessionEnabled: true,
  resourceEnabled: true,
  baseUrl: TEST_BASE_URL,
  kind: 'factory',
};

function renderActiveModel({
  activeModelId,
  status,
  kind = 'user',
  sessionEnabled = true,
  draftSessionId,
  modelLoading = false,
  modelError,
  setModel = () => Promise.resolve(),
}: {
  activeModelId: string | undefined;
  status: ChatConnectionApi['status'];
  kind?: ChatSessionContextApi['kind'];
  sessionEnabled?: boolean;
  draftSessionId?: string;
  modelLoading?: boolean;
  modelError?: Error;
  setModel?: (modelId: string) => Promise<void>;
}) {
  return renderWithProviders(
    <ChatSessionContext.Provider value={{ ...factorySession, kind, sessionEnabled, draftSessionId }}>
      <ChatConnectionContext.Provider value={{ status }}>
        <ChatModelsContext.Provider value={{ activeModelId, isLoading: modelLoading, error: modelError, setModel }}>
          <ActiveModel />
          <Toaster position="bottom-right" />
        </ChatModelsContext.Provider>
      </ChatConnectionContext.Provider>
    </ChatSessionContext.Provider>,
  );
}

function stubModelCatalog(ids: string[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: ids.map(id => {
          const [provider, modelName] = id.split('/');
          return { id, provider, modelName, hasApiKey: true };
        }),
      }),
    ),
  );
}

describe('ActiveModel', () => {
  describe('when the connection is still resolving and no model id is known yet', () => {
    it('shows a loading skeleton instead of a "No model" label', () => {
      renderActiveModel({ activeModelId: undefined, status: 'connecting' });

      expect(screen.getByLabelText('Loading model')).toBeInTheDocument();
      expect(screen.queryByText('No model')).not.toBeInTheDocument();
    });
  });

  describe('when the draft model fails to resolve', () => {
    it('shows the failure instead of a "No model" label', () => {
      renderActiveModel({
        activeModelId: undefined,
        status: 'ready',
        modelError: new Error('Factory unavailable'),
      });

      expect(screen.getByLabelText('Model unavailable')).toHaveAttribute('title', 'Factory unavailable');
      expect(screen.queryByText('No model')).not.toBeInTheDocument();
    });
  });

  describe('when there is no session yet — a draft composer', () => {
    it('picks the model the first prompt will create the session on', async () => {
      const user = userEvent.setup();
      const setModel = vi.fn<(modelId: string) => Promise<void>>().mockResolvedValue();
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);

      renderActiveModel({
        activeModelId: 'anthropic/claude-sonnet-4-5',
        status: 'connecting',
        sessionEnabled: false,
        draftSessionId: 'draft-1',
        setModel,
      });

      await user.click(await screen.findByLabelText('Session model'));
      await user.click(await screen.findByRole('option', { name: 'openai / gpt-5.6-sol' }));

      expect(setModel).toHaveBeenCalledWith('openai/gpt-5.6-sol');
    });
  });

  describe('when the connection is ready but reports no model', () => {
    it('falls back to the explicit "No model" label', () => {
      renderActiveModel({ activeModelId: undefined, status: 'ready' });

      expect(screen.getByText('No model')).toBeInTheDocument();
      expect(screen.queryByLabelText('Loading model')).not.toBeInTheDocument();
    });
  });

  describe('when a connected session has a credentialed model', () => {
    it('renders the formatted model name without a warning', async () => {
      stubModelCatalog(['anthropic/claude-sonnet-4-5']);
      renderActiveModel({ activeModelId: 'anthropic/claude-sonnet-4-5', status: 'ready' });

      expect(await screen.findByText('Claude Sonnet 4.5')).toBeInTheDocument();
      expect(screen.queryByText(/not configured/)).not.toBeInTheDocument();
    });
  });

  describe('when the active model is missing from the credentialed catalog', () => {
    it('flags the model as not configured', async () => {
      stubModelCatalog(['openai/gpt-5']);
      renderActiveModel({ activeModelId: 'anthropic/claude-sonnet-4-5', status: 'ready' });

      expect(await screen.findByLabelText('Claude Sonnet 4.5 is not configured')).toBeInTheDocument();
    });
  });

  describe('when a factory review session has multiple credentialed models', () => {
    it('switches the session model selected from the status line', async () => {
      const user = userEvent.setup();
      const setModel = vi.fn<(modelId: string) => Promise<void>>().mockResolvedValue();
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);
      renderActiveModel({
        activeModelId: 'anthropic/claude-sonnet-4-5',
        status: 'ready',
        kind: 'factory',
        setModel,
      });

      await user.click(await screen.findByLabelText('Session model'));
      await user.click(await screen.findByRole('option', { name: 'openai / gpt-5.6-sol' }));

      expect(setModel).toHaveBeenCalledWith('openai/gpt-5.6-sol');
    });

    it('disables further model changes while a switch is pending', async () => {
      const user = userEvent.setup();
      const setModel = vi.fn<(modelId: string) => Promise<void>>(() => new Promise<void>(() => {}));
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);
      renderActiveModel({
        activeModelId: 'anthropic/claude-sonnet-4-5',
        status: 'ready',
        kind: 'factory',
        setModel,
      });

      const trigger = await screen.findByLabelText('Session model');
      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'openai / gpt-5.6-sol' }));

      expect(trigger).toHaveAttribute('aria-busy', 'true');
      expect(trigger).toBeDisabled();
    });

    it('surfaces a failed switch and keeps the control usable', async () => {
      const user = userEvent.setup();
      const setModel = vi
        .fn<(modelId: string) => Promise<void>>()
        .mockRejectedValue(new Error('Provider is unavailable'));
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);
      renderActiveModel({
        activeModelId: 'anthropic/claude-sonnet-4-5',
        status: 'ready',
        kind: 'factory',
        setModel,
      });

      const trigger = await screen.findByLabelText('Session model');
      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'openai / gpt-5.6-sol' }));

      expect(await screen.findByText('Provider is unavailable')).toBeInTheDocument();
      expect(trigger).toBeEnabled();
      expect(trigger).toHaveTextContent('Claude Sonnet 4.5');
    });

    it('flags an active model the catalog no longer credentials', async () => {
      stubModelCatalog(['openai/gpt-5.6-sol']);
      renderActiveModel({ activeModelId: 'anthropic/claude-sonnet-4-5', status: 'ready', kind: 'factory' });

      const trigger = await screen.findByLabelText('Session model, Claude Sonnet 4.5 is not configured');
      expect(trigger).toHaveTextContent('not configured');
    });
  });
});
