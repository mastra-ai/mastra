import { useState } from 'react';
import { FactoryModelControls } from '../../model-picker/factory-model-controls';
import { modes } from '../../model-picker/models';
import type { ModelControlState } from '../../model-picker/models';
import { reviewCommands } from '../commands';
import type { ChatFile, Phase } from '../data';
import { DraftAttachments } from './attachments';
import { ConversationComposerStatus } from './status';
import { useConversationDraft } from './use-conversation-draft';
import type { ComposerTone } from '@/ds/components/Composer';
import {
  Composer,
  ComposerActions,
  ComposerSendButton,
  ComposerStopButton,
  ComposerAttachmentButton,
  ComposerBox,
  ComposerInput,
  ComposerRing,
  ComposerSuggestions,
  useComposerCommands,
} from '@/ds/components/Composer';

export function FactoryConversationComposer({
  phase,
  busy,
  personal,
  tone,
  modelState,
  onSend,
  onStop,
}: {
  phase?: Phase;
  busy: boolean;
  personal: boolean;
  tone: ComposerTone;
  modelState: ModelControlState;
  onSend: (text: string, files: ChatFile[]) => void;
  onStop: () => void;
}) {
  const streaming = phase === 'streaming';
  const sendBlocked = busy && !streaming;
  const draft = useConversationDraft({ disabled: sendBlocked, onSend });
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
          <ComposerActions>
            <FactoryModelControls personal={personal} mode={mode} onModeChange={setMode} state={modelState} />
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <ComposerAttachmentButton
                appearance="outline"
                aria-label="Add attachments"
                onClick={() => draft.fileInput.current?.click()}
              />
              {streaming && (
                <ComposerStopButton
                  appearance="outline"
                  aria-label="Stop response"
                  onClick={() => {
                    onStop();
                    draft.messageInput.current?.focus();
                  }}
                />
              )}
              <ComposerSendButton appearance="outline" aria-label="Send message" disabled={!draft.canSend} />
            </div>
            <ConversationComposerStatus phase={phase} reading={draft.reading} />
          </ComposerActions>
        </ComposerBox>
      </ComposerRing>
    </Composer>
  );
}
