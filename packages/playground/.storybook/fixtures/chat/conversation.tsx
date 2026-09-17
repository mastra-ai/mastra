import { ChatConversation } from '../../../../playground-ui/.storybook/fixtures/chat/conversation';
import type { Scenario } from '../../../../playground-ui/.storybook/fixtures/chat/data';
import type { ModelControlState } from '../../../../playground-ui/.storybook/fixtures/model-picker/models';
import { StudioConversationComposer } from './composer';

export function StudioChatConversation({
  scenario,
  modelState = 'ready',
  canSendWhileStreaming = false,
}: {
  scenario: Scenario;
  modelState?: ModelControlState;
  canSendWhileStreaming?: boolean;
}) {
  return (
    <ChatConversation key={modelState} scenario={scenario} presentation="studio" canInterject={canSendWhileStreaming}>
      {controls => (
        <StudioConversationComposer {...controls} modelState={modelState} canInterject={canSendWhileStreaming} />
      )}
    </ChatConversation>
  );
}
