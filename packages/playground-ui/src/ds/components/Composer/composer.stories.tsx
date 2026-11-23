import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ComposerModeStates, ComposerPreview } from '../../../../.storybook/fixtures/composer';

import { Button } from '../Button';
import { Composer, ComposerActions, ComposerBox, ComposerInput, ComposerRing } from './composer';
import { IconArrowUp } from '@/ds/icons/central/IconArrowUp';

const meta: Meta<typeof Composer> = {
  title: 'AI/Composer',
  component: Composer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'ComposerRing owns the rim: it lights from the top on hover and focus, and while busy faint mono threads of light wander its top edge around the centre, so it always reads as working. ComposerToneLabel colours a mode label green, purple or orange; the default tone keeps it neutral. Applications map their own modes to tones. ComposerInput uses the inline height by default, or variant="textarea" for a taller draft; maxHeight remains available. Compose the shared surface, input, and actions with application-owned controls, draft state, attachments, and send/cancel callbacks. See [Composer Attachments](?path=/docs/ai-composer-attachments--docs) for the shared Studio and Factory attachment cards, previews, and removal controls. Changing mode never implies a running state. The interactive previews simulate sending and stopping; they do not call an agent.',
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
        <ComposerInput aria-label="Message" placeholder="Enter your message" />
        <ComposerActions>
          <span />
          <Button type="submit" size="icon-md" aria-label="Send message" disabled>
            <IconArrowUp />
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
          <span className="text-caption text-muted-foreground">Running</span>
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
        <ComposerInput aria-label="Message" placeholder="Enter your message" />
        <ComposerActions>
          <span />
          <Button type="submit" size="icon-md" aria-label="Send message">
            <IconArrowUp />
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
    await expect(canvas.getByText('Plan').closest('[data-composer-tone]')).toHaveAttribute(
      'data-composer-tone',
      'purple',
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
