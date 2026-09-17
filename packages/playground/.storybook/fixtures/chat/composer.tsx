import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import {
  Composer,
  ComposerActions,
  ComposerSendButton,
  ComposerStopButton,
  ComposerAttachmentPicker,
  ComposerBox,
  ComposerInput,
  ComposerRing,
} from '@mastra/playground-ui/components/Composer';
import { useState } from 'react';
import { DraftAttachments } from '../../../../playground-ui/.storybook/fixtures/chat/composer/attachments';
import { ConversationComposerStatus } from '../../../../playground-ui/.storybook/fixtures/chat/composer/status';
import { useStoryComposerDraft } from '../../../../playground-ui/.storybook/fixtures/chat/composer/use-story-composer-draft';
import type { StoryComposerControls } from '../../../../playground-ui/.storybook/fixtures/chat/conversation';
import type { ModelControlState } from '../../../../playground-ui/.storybook/fixtures/model-picker/models';
import { initialStudioModelSelection } from '../../../../playground-ui/.storybook/fixtures/model-picker/models';
import { DictationButton } from '../../../src/domains/voice/components/dictation-button';
import { VoiceCallButtonView as VoiceCallButton } from '../../../src/domains/voice/components/voice-call-button';
import { VoiceCallPanelView as VoiceCallPanel } from '../../../src/domains/voice/components/voice-call-panel';
import type { VoiceCallStatus } from '../../../src/domains/voice/types';
import { StudioModelControls, StudioModelWarnings } from '../studio-model-controls';

export function StudioConversationComposer({
  phase,
  busy,
  modelState,
  canInterject,
  onSend,
  onStop,
}: StoryComposerControls & {
  modelState: ModelControlState;
  canInterject: boolean;
}) {
  const streaming = phase === 'streaming';
  const draft = useStoryComposerDraft({ disabled: busy && !(streaming && canInterject), onSend });
  const [selection, setSelection] = useState(initialStudioModelSelection);
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
            <StudioModelWarnings state={modelState} provider={selection.provider} />
            <ComposerActions>
              <StudioModelControls state={modelState} selection={selection} onSelectionChange={setSelection} />
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
                  <DictationButton
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
