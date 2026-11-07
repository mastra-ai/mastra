import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp, ImagePlus, Mic } from 'lucide-react';
import { useState } from 'react';

import { ModelPicker } from '../../../domains/llm/model-picker';
import type { ModelPickerProvider, ModelPickerValue } from '../../../domains/llm/model-picker';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import {
  Composer,
  ComposerActions,
  ComposerActionsEnd,
  ComposerActionsStart,
  ComposerBox,
  ComposerHeader,
  ComposerHeaderContent,
  ComposerHeaderRow,
  ComposerInput,
  ComposerRing,
  ComposerStatus,
} from './index';

const providers: ModelPickerProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', badge: 'Default' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-5-mini', name: 'GPT-5 mini' },
    ],
  },
  { id: 'google', name: 'Google', connected: false, models: [{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }] },
];

interface LayoutStoryProps {
  reconnecting?: boolean;
  status?: boolean;
}

const LayoutStory = ({ reconnecting = false, status = false }: LayoutStoryProps) => {
  const [model, setModel] = useState<ModelPickerValue>({ provider: 'anthropic', model: 'claude-sonnet-4-6' });

  return (
    <div className="flex h-[420px] flex-col justify-end gap-1.5">
      <p className="text-body-sm text-muted-foreground">Transcript content stays put when the header opens.</p>
      <ComposerStatus>
        {status && (
          <>
            <span>You&apos;re steering Sam&apos;s session</span>
            <span>2 queued</span>
          </>
        )}
      </ComposerStatus>
      <Composer aria-label="Message composer">
        <ComposerHeader placement="overlay" open={reconnecting}>
          <ComposerHeaderRow role="status" aria-live="polite">
            <Spinner size="sm" aria-hidden="true" role="presentation" />
            <ComposerHeaderContent>Reconnecting…</ComposerHeaderContent>
          </ComposerHeaderRow>
        </ComposerHeader>
        <ComposerRing>
          <ComposerBox>
            <ComposerInput aria-label="Message" placeholder="Message the agent" />
            <ComposerActions>
              <ComposerActionsStart>
                <Button type="button" variant="ghost" size="icon-sm" tooltip="Attach image">
                  <ImagePlus />
                </Button>
              </ComposerActionsStart>
              <ComposerActionsEnd>
                <ModelPicker providers={providers} value={model} onValueChange={setModel} />
                <Button type="button" variant="ghost" size="icon-sm" tooltip="Start dictation">
                  <Mic />
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="icon-sm"
                  disabled={reconnecting}
                  tooltip={reconnecting ? 'Sends once reconnected' : 'Send'}
                >
                  <ArrowUp />
                </Button>
              </ComposerActionsEnd>
            </ComposerActions>
          </ComposerBox>
        </ComposerRing>
      </Composer>
    </div>
  );
};

const meta: Meta<typeof LayoutStory> = {
  title: 'AI/Composer/Layout',
  component: LayoutStory,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Shared composer layout for Studio and Factory: a right-aligned status row above the composer, an overlay header that never moves the transcript, leading actions on the left, and model, voice and the primary Send on the right. The model picker opens as a popover and as a bottom sheet on small screens.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof LayoutStory>;

export const Default: Story = { args: {} };

export const WithStatus: Story = { args: { status: true } };

export const Reconnecting: Story = { args: { status: true, reconnecting: true } };
