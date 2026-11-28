import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../Button';
import { SaveBar } from './save-bar';
import type { SaveBarTone } from './save-bar';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconFloppyDisk1 } from '@/ds/icons/central/IconFloppyDisk1';

const meta = {
  title: 'Composite/SaveBar',
  component: SaveBar,
  parameters: {
    docs: {
      description: {
        component:
          'A raised bar under an editor that says what state the edits are in and holds the actions that move them along, such as Save and Publish. `tone` sets the status colour and icon: `success` after a save lands, `error` when it fails, which also shakes the bar once and announces the status as an alert. Reduced motion keeps the colour and drops the movement.',
      },
    },
  },
  decorators: [
    Story => (
      <div className="max-w-170">
        <Story />
      </div>
    ),
  ],
  args: { status: 'Saved as a draft. Publish to use it in new conversations.' },
} satisfies Meta<typeof SaveBar>;

export default meta;
type Story = StoryObj<typeof meta>;

function Actions({ dirty, publishable = true }: { dirty?: boolean; publishable?: boolean }) {
  return (
    <>
      <Button variant="ghost" size="sm" icon={<IconFloppyDisk1 />} disabled={!dirty}>
        Save
      </Button>
      <Button variant="primary" size="sm" icon={<IconCheckmark2Medium />} disabled={!publishable}>
        Publish
      </Button>
    </>
  );
}

export const Draft: Story = { render: args => <SaveBar {...args}>{<Actions />}</SaveBar> };

export const UnsavedEdits: Story = {
  args: { status: 'You have unsaved edits.' },
  render: args => <SaveBar {...args}>{<Actions dirty />}</SaveBar>,
};

export const Published: Story = {
  args: { status: 'Published. New conversations use this version.', tone: 'success' },
  render: args => <SaveBar {...args}>{<Actions publishable={false} />}</SaveBar>,
};

export const PublishFailed: Story = {
  args: {
    status: 'Couldn’t publish. Your draft is saved and agents keep using v3.',
    tone: 'error',
  },
  render: args => <SaveBar {...args}>{<Actions />}</SaveBar>,
};

type Step = { status: string; tone: SaveBarTone; dirty: boolean; publishable: boolean };

const STEPS: Record<'dirty' | 'saved' | 'published' | 'failed', Step> = {
  dirty: { status: 'You have unsaved edits.', tone: 'neutral', dirty: true, publishable: true },
  saved: {
    status: 'Saved as a draft. Publish to use it in new conversations.',
    tone: 'neutral',
    dirty: false,
    publishable: true,
  },
  published: {
    status: 'Published. New conversations use this version.',
    tone: 'success',
    dirty: false,
    publishable: false,
  },
  failed: {
    status: 'Couldn’t publish. Your draft is saved and agents keep using v3.',
    tone: 'error',
    dirty: false,
    publishable: true,
  },
};

function SaveBarFlow() {
  const [step, setStep] = useState<Step>(STEPS.dirty);
  const [failNext, setFailNext] = useState(true);
  return (
    <div className="flex flex-col gap-4">
      <SaveBar status={step.status} tone={step.tone}>
        <Button
          variant="ghost"
          size="sm"
          icon={<IconFloppyDisk1 />}
          disabled={!step.dirty}
          onClick={() => setStep(STEPS.saved)}
        >
          Save
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<IconCheckmark2Medium />}
          disabled={!step.publishable}
          onClick={() => {
            setStep(failNext ? STEPS.failed : STEPS.published);
            setFailNext(!failNext);
          }}
        >
          {step.tone === 'error' ? 'Try again' : 'Publish'}
        </Button>
      </SaveBar>
      <Button size="sm" className="self-start" onClick={() => setStep(STEPS.dirty)}>
        Edit again
      </Button>
    </div>
  );
}

export const Interactive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Save, then Publish: the first publish fails and shakes the bar, Try again succeeds.',
      },
    },
  },
  render: () => <SaveBarFlow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Saved as a draft');
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Couldn’t publish');
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Published');
  },
};
