import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/web-ui/render';
import { ChatConnectionContext } from '../ChatConnectionContext';
import { ChatModelsProvider } from '../ChatModelsProvider';
import { ChatSessionContext } from '../ChatSessionContext';
import { useChatModels } from '../useChatModels';

const RESOURCE_ID = 'resource-model-switch';
const PREVIOUS_MODEL = 'openai/gpt-4o-mini';
const NEXT_MODEL = 'anthropic/claude-opus-4-8';

function ModelProbe() {
  const { activeModelId, setModel } = useChatModels();

  return (
    <>
      <span>{activeModelId}</span>
      <button type="button" onClick={() => void setModel(NEXT_MODEL).catch(() => {})}>
        Switch model
      </button>
    </>
  );
}

describe('ChatModelsProvider', () => {
  describe('when a model switch is pending', () => {
    it('exposes the requested model optimistically', async () => {
      let releaseRequest: () => void = () => {};
      const requestGate = new Promise<void>(resolve => {
        releaseRequest = resolve;
      });
      server.use(
        http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${RESOURCE_ID}/model`, async () => {
          await requestGate;
          return HttpResponse.json({ ok: true });
        }),
      );

      const { client } = renderWithProviders(
        <ChatSessionContext.Provider
          value={{
            resourceId: RESOURCE_ID,
            sessionEnabled: true,
            resourceEnabled: true,
            baseUrl: TEST_BASE_URL,
            kind: 'user',
          }}
        >
          <ChatConnectionContext.Provider
            value={{
              status: 'ready',
              threadId: 'thread-a',
              state: {
                controllerId: 'code',
                resourceId: RESOURCE_ID,
                threadId: 'thread-a',
                modeId: 'build',
                modelId: PREVIOUS_MODEL,
              },
            }}
          >
            <ChatModelsProvider>
              <ModelProbe />
            </ChatModelsProvider>
          </ChatConnectionContext.Provider>
        </ChatSessionContext.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Switch model' }));

      expect(await screen.findByText(NEXT_MODEL)).toBeInTheDocument();
      expect(screen.queryByText(PREVIOUS_MODEL)).not.toBeInTheDocument();

      releaseRequest();
      await waitForMutationsIdle(client);
    });
  });
});
