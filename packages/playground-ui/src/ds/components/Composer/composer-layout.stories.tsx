import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp, Mic } from 'lucide-react';
import { useState } from 'react';

import { ModelPicker } from '../../../domains/llm/model-picker';
import type { ModelPickerProvider, ModelPickerValue } from '../../../domains/llm/model-picker-types';
import { ProviderLogo } from '../../../domains/llm/provider-logo';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { ThinkingLevelBars, ThinkingLevelRamp } from '../ThinkingLevel';
import type { ThinkingLevelOption } from '../ThinkingLevel';
import {
  Composer,
  ComposerActions,
  ComposerActionsEnd,
  ComposerActionsStart,
  ComposerAttachMenu,
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
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
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

const thinkingLevels: ThinkingLevelOption[] = [
  { value: 'off', label: 'Off', emphasis: 'muted' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max', emphasis: 'warning' },
];

interface LayoutStoryProps {
  reconnecting?: boolean;
  status?: boolean;
  /** Only Anthropic is connected, so the picker drops its provider filter and group heading. */
  singleProvider?: boolean;
}

const LayoutStory = ({ reconnecting = false, status = false, singleProvider = false }: LayoutStoryProps) => {
  const [model, setModel] = useState<ModelPickerValue>({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
  const [thinking, setThinking] = useState('high');

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
                <ComposerAttachMenu onFiles={() => {}} accept="image/*" label="Attach images" />
              </ComposerActionsStart>
              <ComposerActionsEnd>
                <ModelPicker
                  providers={singleProvider ? providers.slice(0, 1) : providers}
                  value={model}
                  onValueChange={setModel}
                  defaultModel={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
                  addProvider={{ label: 'Connect a provider', render: <a href="#connect-provider" /> }}
                  settings={
                    <ThinkingLevelRamp
                      options={thinkingLevels}
                      value={thinking}
                      label="Thinking"
                      onChange={setThinking}
                    />
                  }
                >
                  <span className="sr-only">Model: </span>
                  <ProviderLogo providerId={model.provider} size={14} />
                  <span className="truncate max-sm:max-w-28">
                    {providers.flatMap(provider => provider.models).find(option => option.id === model.model)?.name}
                  </span>
                  <ThinkingLevelBars options={thinkingLevels} value={thinking} />
                </ModelPicker>
                <Button type="button" variant="ghost" size="icon-sm" tooltip="Start dictation">
                  <Mic />
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="icon-sm"
                  disabled={reconnecting}
                  tooltip={reconnecting ? 'You can send once reconnected' : 'Send'}
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
          'Shared composer layout for Studio and Factory: a right-aligned status row above the composer, an overlay header that never moves the transcript, the "+" attach menu on the left, and model, voice and the primary Send on the right. The model picker holds the thinking level and a link to connect a provider, and opens as a popover, or as a bottom sheet on small screens.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof LayoutStory>;

export const Default: Story = { args: {} };

export const WithStatus: Story = { args: { status: true } };

export const Reconnecting: Story = { args: { status: true, reconnecting: true } };

export const SingleProvider: Story = { args: { singleProvider: true } };
