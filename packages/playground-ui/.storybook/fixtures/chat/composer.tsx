import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { CombinedPicker } from '../model-picker/combined-picker';
import { modes } from '../model-picker/models';
import { reviewCommands } from './commands';
import { DraftAttachments } from './composer/attachments';
import { ConversationComposerStatus } from './composer/status';
import { useStoryComposerDraft } from './composer/use-story-composer-draft';
import type { StoryComposerControls } from './conversation';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import {
  Composer,
  ComposerActions,
  ComposerAttachmentButton,
  ComposerBox,
  ComposerInput,
  ComposerModeSelect,
  ComposerRing,
  ComposerSendButton,
  ComposerStopButton,
  ComposerSuggestions,
  useComposerCommands,
} from '@/ds/components/Composer';

export function ConversationComposer({
  phase,
  busy,
  onSend,
  onStop,
  children,
  tone = 'green',
  appearance = 'outline',
}: StoryComposerControls & {
  children: ReactNode;
  tone?: ComponentProps<typeof ComposerRing>['tone'];
  appearance?: ComponentProps<typeof ComposerSendButton>['appearance'];
}) {
  const draft = useStoryComposerDraft({ disabled: busy, onSend });
  const commands = useComposerCommands({
    commands: reviewCommands,
    value: draft.text,
    onValueChange: draft.setText,
    onSubmit: draft.submitMessage,
    inputRef: draft.messageInput,
    enabled: !busy,
  });
  return (
    <Composer aria-label="Chat composer" onSubmit={draft.onSubmit}>
      <ComposerRing busy={phase === 'streaming'} tone={tone}>
        <ComposerBox sendingPulseKey={draft.sentCount}>
          <ComposerSuggestions {...commands.suggestionsProps} />
          <DraftAttachments
            files={draft.files}
            onRemove={draft.removeFile}
            onFilesSelected={draft.addFiles}
            inputRef={draft.fileInput}
          />
          <ComposerInput
            {...commands.inputProps}
            ref={draft.messageInput}
            onKeyDown={draft.inputProps.onKeyDown}
            aria-label="Message"
            placeholder="Ask a follow-up, or / for commands…"
          />
          <ComposerActions>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
            <ButtonsGroup className="ml-auto" spacing="close" aria-label="Composer actions">
              <ComposerAttachmentButton
                appearance={appearance}
                aria-label="Add attachment"
                onClick={() => draft.fileInput.current?.click()}
              />
              {phase === 'streaming' ? (
                <ComposerStopButton
                  appearance={appearance}
                  aria-label="Stop response"
                  onClick={() => {
                    onStop();
                    draft.messageInput.current?.focus();
                  }}
                />
              ) : (
                <ComposerSendButton appearance={appearance} disabled={!draft.canSend} aria-label="Send message" />
              )}
            </ButtonsGroup>
            <ConversationComposerStatus phase={phase} reading={draft.reading} />
          </ComposerActions>
        </ComposerBox>
      </ComposerRing>
    </Composer>
  );
}

export function ComposerWithModelMenu(props: StoryComposerControls) {
  const [modeId, setModeId] = useState('build');
  const mode = modes.find(option => option.id === modeId);
  return (
    <ConversationComposer {...props} tone={mode?.tone}>
      <ComposerModeSelect modes={modes} value={modeId} onValueChange={setModeId} />
      <CombinedPicker />
    </ConversationComposer>
  );
}
