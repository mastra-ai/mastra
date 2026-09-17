import { ComposerActionRow } from '../../../src/ui/domains/chat/components/ComposerActionRow';
import { useState } from 'react';
import { FactoryModelControls } from '../factory-model-controls';
import { modes } from '../../../../../packages/playground-ui/.storybook/fixtures/model-picker/models';
import type { ModelControlState } from '../../../../../packages/playground-ui/.storybook/fixtures/model-picker/models';
import { reviewCommands } from '../../../../../packages/playground-ui/.storybook/fixtures/chat/commands';
import type { StoryComposerControls } from '../../../../../packages/playground-ui/.storybook/fixtures/chat/conversation';
import { DraftAttachments } from '../../../../../packages/playground-ui/.storybook/fixtures/chat/composer/attachments';
import { ConversationComposerStatus } from '../../../../../packages/playground-ui/.storybook/fixtures/chat/composer/status';
import { useStoryComposerDraft } from '../../../../../packages/playground-ui/.storybook/fixtures/chat/composer/use-story-composer-draft';
import type { ComposerTone } from '@mastra/playground-ui/components/Composer';
import {
  Composer,
  ComposerBox,
  ComposerInput,
  ComposerRing,
  ComposerSuggestions,
  useComposerCommands,
} from '@mastra/playground-ui/components/Composer';

export function FactoryConversationComposer({
  phase,
  busy,
  personal,
  tone,
  modelState,
  onSend,
  onStop,
}: StoryComposerControls & {
  personal: boolean;
  tone: ComposerTone;
  modelState: ModelControlState;
}) {
  const streaming = phase === 'streaming';
  const sendBlocked = busy && !streaming;
  const draft = useStoryComposerDraft({ disabled: sendBlocked, onSend });
  const [mode, setMode] = useState('build');
  const commands = useComposerCommands({
    commands: reviewCommands,
    value: draft.text,
    onValueChange: draft.setText,
    onSubmit: draft.submitMessage,
    inputRef: draft.messageInput,
    enabled: !sendBlocked,
  });
  const ringTone = personal ? (modes.find(option => option.id === mode)?.tone ?? tone) : tone;
  return (
    <Composer aria-label="Chat composer" onSubmit={draft.onSubmit}>
      <ComposerRing busy={streaming} tone={ringTone}>
        <ComposerBox sendingPulseKey={draft.sentCount}>
          <ComposerSuggestions {...commands.suggestionsProps} />
          <DraftAttachments
            files={draft.files}
            onRemove={draft.removeFile}
            onFilesSelected={draft.addFiles}
            inputRef={draft.fileInput}
            accept="image/*"
          />
          <ComposerInput
            {...commands.inputProps}
            ref={draft.messageInput}
            onKeyDown={draft.inputProps.onKeyDown}
            aria-label="Message"
            placeholder="Ask a follow-up, or / for commands…"
          />
          <ComposerActionRow
            onAttach={() => draft.fileInput.current?.click()}
            attachDisabled={sendBlocked}
            sendDisabled={!draft.canSend}
            onAbort={
              streaming
                ? () => {
                    onStop();
                    draft.messageInput.current?.focus();
                  }
                : undefined
            }
          >
            <FactoryModelControls personal={personal} mode={mode} onModeChange={setMode} state={modelState} />
            <ConversationComposerStatus phase={phase} reading={draft.reading} />
          </ComposerActionRow>
        </ComposerBox>
      </ComposerRing>
    </Composer>
  );
}
