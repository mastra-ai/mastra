import { useState } from 'react';
import type { ModelControlState } from '../../model-picker/models';
import { StudioModelControls, StudioModelWarnings } from '../../model-picker/studio-model-controls';
import type { ChatFile, Phase } from '../data';
import { DraftAttachments } from './attachments';
import { ConversationComposerStatus } from './status';
import { useConversationDraft } from './use-conversation-draft';
import { VoiceCallButton, VoiceCallPanel } from '@/ds/components/ai/voice-call';
import type { VoiceCallStatus } from '@/ds/components/ai/voice-call';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import {
  Composer,
  ComposerActions,
  ComposerSendButton,
  ComposerStopButton,
  ComposerAttachmentPicker,
  ComposerDictationButton,
  ComposerBox,
  ComposerInput,
  ComposerRing,
} from '@/ds/components/Composer';

export function StudioConversationComposer({
  phase,
  busy,
  modelState,
  canInterject,
  onSend,
  onStop,
}: {
  phase?: Phase;
  busy: boolean;
  modelState: ModelControlState;
  canInterject: boolean;
  onSend: (text: string, files: ChatFile[]) => void;
  onStop: () => void;
}) {
  const streaming = phase === 'streaming';
  const draft = useConversationDraft({ disabled: busy && !(streaming && canInterject), onSend });
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceCallStatus>('idle');
  return (
    <>
      <VoiceCallPanel status={voiceStatus} agentState="listening" captions={[]} />
      <Composer aria-label="Chat composer" onSubmit={draft.onSubmit}>
        <ComposerRing busy={streaming} tone="green">
          <ComposerBox sendingPulseKey={draft.sentCount}>
            <DraftAttachments
              files={draft.files}
              onRemove={draft.removeFile}
              onFilesSelected={draft.addFiles}
              inputRef={draft.fileInput}
            />
            <ComposerInput {...draft.inputProps} aria-label="Message" placeholder="Enter your message..." />
            <StudioModelWarnings state={modelState} />
            <ComposerActions>
              <StudioModelControls state={modelState} />
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <ButtonsGroup spacing="close">
                  <ComposerAttachmentPicker
                    open={attachmentOpen}
                    onOpenChange={setAttachmentOpen}
                    onChooseFiles={() => draft.fileInput.current?.click()}
                    onSubmitUrl={url => {
                      draft.addUrl(url);
                      setAttachmentOpen(false);
                    }}
                  />
                  <ComposerDictationButton
                    listening={listening}
                    onClick={() => {
                      setListening(current => !current);
                      if (listening)
                        draft.setText(current => `${current}${current ? ' ' : ''}Review the composer keyboard access.`);
                    }}
                  />
                  <VoiceCallButton
                    status={voiceStatus}
                    available
                    onStart={() => setVoiceStatus('active')}
                    onStop={() => setVoiceStatus('idle')}
                  />
                </ButtonsGroup>
                {(!streaming || canInterject) && (
                  <ComposerSendButton aria-label="Send message" disabled={!draft.canSend} />
                )}
                {streaming && (
                  <ComposerStopButton
                    aria-label="Stop response"
                    onClick={() => {
                      onStop();
                      draft.messageInput.current?.focus();
                    }}
                  />
                )}
              </div>
              <ConversationComposerStatus phase={phase} reading={draft.reading} />
            </ComposerActions>
          </ComposerBox>
        </ComposerRing>
      </Composer>
    </>
  );
}
