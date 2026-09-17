import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ComposerPreview } from '../../playground-ui/.storybook/fixtures/composer';
import { DictationButton } from '../src/domains/voice/components/dictation-button';
import { VoiceCallButtonView as VoiceCallButton } from '../src/domains/voice/components/voice-call-button';
import { VoiceCallPanelView as VoiceCallPanel } from '../src/domains/voice/components/voice-call-panel';
import type { VoiceCallStatus } from '../src/domains/voice/types';
import { StudioModelExample } from './fixtures/studio-model-controls';

const meta = { title: 'Applications/Studio/Composer', component: ComposerWithVoice } satisfies Meta<
  typeof ComposerWithVoice
>;
export default meta;
type Story = StoryObj<typeof meta>;

function ComposerWithVoice() {
  const [status, setStatus] = useState<VoiceCallStatus>('idle');
  const [listening, setListening] = useState(false);
  return (
    <>
      <VoiceCallPanel status={status} agentState="listening" captions={[]} />
      <ComposerPreview
        controls={<StudioModelExample state="ready" />}
        actions={
          <>
            <DictationButton listening={listening} onClick={() => setListening(current => !current)} />
            <VoiceCallButton
              status={status}
              available
              onStart={() => setStatus('active')}
              onStop={() => setStatus('idle')}
            />
          </>
        }
      />
    </>
  );
}

export const WithModelAndVoiceControls: Story = {
  render: () => <ComposerWithVoice />,
};
