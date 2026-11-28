import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useContext } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { ChatCommandsProvider } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatCommandsProvider';
import { ChatModelsContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatModelsContext';
import { ChatPermissionsContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatPermissionsContext';
import { ChatSessionActionsContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatSessionActionsContext';
import { ChatThinkingContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatThinkingContext';
import { useChatModels } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/useChatModels';
import { useChatSessionActions } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/useChatSessionActions';
import { Composer } from '@mastra/playground-ui/domains/factory/session/thread/chat/components/Composer';
import { GoalPanel } from '@mastra/playground-ui/domains/factory/session/thread/chat/components/GoalPanel';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

type Capability = 'goal' | 'followUp' | 'thinking' | 'permissions' | 'modelSwitching';

/** Re-provides the live contexts minus `without`, as a host lacking those capabilities would. */
function WithoutCapabilities({ without, children }: { without: readonly Capability[]; children: ReactNode }) {
  const actions = useChatSessionActions();
  const models = useChatModels();
  const thinking = useContext(ChatThinkingContext);
  const permissions = useContext(ChatPermissionsContext);
  const drop = (capability: Capability) => without.includes(capability);
  return (
    <ChatSessionActionsContext.Provider
      value={{
        ...actions,
        goal: drop('goal') ? undefined : actions.goal,
        followUp: drop('followUp') ? undefined : actions.followUp,
      }}
    >
      <ChatModelsContext.Provider value={{ ...models, select: drop('modelSwitching') ? undefined : models.select }}>
        <ChatThinkingContext.Provider value={drop('thinking') ? null : thinking}>
          <ChatPermissionsContext.Provider value={drop('permissions') ? null : permissions}>
            <ChatCommandsProvider>{children}</ChatCommandsProvider>
          </ChatPermissionsContext.Provider>
        </ChatThinkingContext.Provider>
      </ChatModelsContext.Provider>
    </ChatSessionActionsContext.Provider>
  );
}

function renderWithout(without: readonly Capability[]) {
  return renderWithProviders(
    <OverlayTestProviders>
      <WithoutCapabilities without={without}>
        <GoalPanel />
        <Composer />
      </WithoutCapabilities>
    </OverlayTestProviders>,
  );
}

function commandOption(name: string) {
  return (_accessibleName: string, element: Element | null) => element?.firstElementChild?.textContent === `/${name}`;
}

async function openSlashMenu() {
  const user = userEvent.setup();
  const input = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
  await waitFor(() => expect(input).toBeEnabled());
  await user.type(input, '/');
  await screen.findByRole('option', { name: commandOption('help') });
}

beforeEach(() => {
  useOverlayControllerHandlers();
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: [
          {
            id: 'openai/gpt-4o-mini',
            provider: 'openai',
            modelName: 'gpt-4o-mini',
            hasApiKey: true,
            reasoningOptions: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
          },
        ],
      }),
    ),
  );
});

describe('Session view without optional capabilities', () => {
  it.each<[Capability, readonly string[]]>([
    ['goal', ['goal', 'goal-clear', 'goal-pause', 'goal-resume']],
    ['followUp', ['follow-up']],
    ['thinking', ['think']],
    ['permissions', ['permissions', 'yolo']],
    ['modelSwitching', ['model']],
  ])('hides the %s commands', async (capability, hidden) => {
    renderWithout([capability]);
    await openSlashMenu();

    for (const name of hidden) {
      expect(screen.queryByRole('option', { name: commandOption(name) })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('option', { name: commandOption('cost') })).toBeInTheDocument();
  });

  it('shows the model picker and every command when nothing is missing', async () => {
    renderWithout([]);
    await openSlashMenu();

    expect(await screen.findByRole('button', { name: /^Session model/ })).toBeInTheDocument();
    for (const name of ['goal', 'follow-up', 'think', 'permissions', 'model']) {
      expect(screen.getByRole('option', { name: commandOption(name) })).toBeInTheDocument();
    }
  });

  it('renders with every optional capability missing', async () => {
    renderWithout(['goal', 'followUp', 'thinking', 'permissions', 'modelSwitching']);
    await openSlashMenu();

    expect(screen.queryByRole('button', { name: /^Session model/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Thinking/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /goal/i })).not.toBeInTheDocument();
  });
});
