import type { ComposerTone } from '@mastra/playground-ui/components/Composer';
import { ChatConversation } from '../../../../../packages/playground-ui/.storybook/fixtures/chat/conversation';
import type { Scenario } from '../../../../../packages/playground-ui/.storybook/fixtures/chat/data';
import type { ModelControlState } from '../../../../../packages/playground-ui/.storybook/fixtures/model-picker/models';
import { FactoryConversationComposer } from './composer';

export function FactoryChatConversation({
  scenario,
  modelState = 'ready',
  personal = false,
  tone = 'green',
}: {
  scenario: Scenario;
  modelState?: ModelControlState;
  personal?: boolean;
  tone?: ComposerTone;
}) {
  return (
    <ChatConversation key={`${modelState}-${personal}`} scenario={scenario} presentation="factory" canInterject>
      {controls => (
        <FactoryConversationComposer {...controls} modelState={modelState} personal={personal} tone={tone} />
      )}
    </ChatConversation>
  );
}
