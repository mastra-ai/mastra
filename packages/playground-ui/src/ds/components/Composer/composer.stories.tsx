import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp, Paperclip } from 'lucide-react';
import { expect, userEvent, within } from 'storybook/test';
import { ComposerModeStates, ComposerPreview } from '../../../../.storybook/fixtures/composer';

import { Badge } from '../Badge/Badge';
import { Button } from '../Button';
import { Composer, ComposerActions, ComposerAttachments, ComposerBox, ComposerInput, ComposerRing } from './composer';

const meta: Meta<typeof Composer> = {
  title: 'Elements/Composer',
  component: Composer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'ComposerRing owns the pointer spotlight and busy rotation. Its typed tone defaults to green; purple and orange select the same light/dark colors used by ComposerToneLabel. The default tone uses the accent ring and a neutral label. Applications map their own modes to tones. ComposerInput uses the inline height by default, or variant="textarea" for a taller draft; maxHeight remains available. Compose the shared surface, input, and actions with application-owned controls, draft state, attachments, and send/cancel callbacks. Changing mode never implies a running state. The interactive previews simulate sending and stopping; they do not call an agent.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Composer>;

export const Empty: Story = {
  render: () => (
    <Composer aria-label="Message composer">
      <ComposerBox>
        <ComposerInput aria-label="Message" placeholder="Enter your message..." />
        <ComposerActions>
          <span />
          <Button type="submit" size="icon-md" aria-label="Send message" disabled>
            <ArrowUp />
          </Button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  ),
};

export const WithAttachmentsAndActions: Story = {
  render: () => (
    <Composer aria-label="Message composer">
      <ComposerAttachments>
        <Badge size="sm">project-notes.txt</Badge>
      </ComposerAttachments>
      <ComposerBox>
        <ComposerInput aria-label="Message" defaultValue="Summarize the attached notes." />
        <ComposerActions>
          <Button type="button" size="icon-md" aria-label="Attach file">
            <Paperclip />
          </Button>
          <Button type="submit" size="icon-md" aria-label="Send message">
            <ArrowUp />
          </Button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  ),
};

export const DisabledAndRunning: Story = {
  render: () => (
    <Composer aria-label="Message composer">
      <ComposerBox sendingPulseKey={1}>
        <ComposerInput aria-label="Message" value="Waiting for the current run..." disabled readOnly />
        <ComposerActions>
          <span className="text-ui-sm text-neutral3">Running</span>
          <Button type="button" size="md">
            Cancel
          </Button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  ),
};

const RingStory = ({ busy }: { busy: boolean }) => (
  <Composer aria-label="Message composer">
    <ComposerRing busy={busy}>
      <ComposerBox>
        <ComposerInput aria-label="Message" placeholder="Enter your message..." />
        <ComposerActions>
          <span />
          <Button type="submit" size="icon-md" aria-label="Send message">
            <ArrowUp />
          </Button>
        </ComposerActions>
      </ComposerBox>
    </ComposerRing>
  </Composer>
);

export const RingIdle: Story = {
  render: () => <RingStory busy={false} />,
};

export const RingBusy: Story = {
  render: () => <RingStory busy />,
};

export const ModeStates: Story = {
  render: () => <ComposerModeStates />,
};

export const ModeStatesLight: Story = {
  ...ModeStates,
  globals: { backgrounds: { value: 'light' } },
};

export const WithModeControls: Story = {
  render: () => <ComposerPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox', { name: 'Session mode' }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('option', { name: 'Plan' }));
    const label = canvas.getByText('Plan');
    const ring = canvasElement.querySelector('[data-slot="composer-ring"]');
    if (!ring) throw new Error('Composer ring is missing');
    await expect(getComputedStyle(ring).getPropertyValue('--composer-tone-color')).toBe(
      getComputedStyle(label).getPropertyValue('--composer-tone-color'),
    );
    const input = canvas.getByRole('textbox', { name: 'Message' });
    await userEvent.type(input, 'Review this plan.{shift>}{enter}{/shift}Keep both lines.');
    await expect(input).toHaveValue('Review this plan.\nKeep both lines.');
    await userEvent.keyboard('{enter}');
    await expect(input).toHaveValue('');
    await userEvent.click(canvas.getByRole('button', { name: 'Stop response' }));
    await expect(input).toHaveFocus();
    await expect(canvas.getByRole('combobox', { name: 'Session mode' })).toHaveTextContent('Plan');
  },
};

export const WithModelAndVoiceControls: Story = {
  render: () => <ComposerPreview controls="model" />,
};

export const TallDraft: Story = {
  render: () => <ComposerPreview variant="textarea" mode="plan" />,
};

export const Disabled: Story = {
  render: () => <ComposerPreview disabled />,
};

export const CustomMode: Story = {
  render: () => <ComposerPreview mode="review" />,
};
