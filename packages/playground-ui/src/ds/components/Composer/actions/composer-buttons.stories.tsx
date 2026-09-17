import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  ComposerAttachmentButton,
  ComposerModelSettingsButton,
  ComposerSendButton,
  ComposerStopButton,
} from './composer-buttons';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';

const meta = {
  title: 'Elements/Composer actions',
  component: ComposerSendButton,
  args: { appearance: 'round', 'aria-label': 'Send message', onClick: fn() },
  argTypes: { appearance: { control: 'inline-radio', options: ['round', 'outline'] } },
  parameters: {
    docs: {
      description: {
        component:
          'Shared action buttons accept normal button props and callbacks. Compose them in ComposerActions or ButtonsGroup. The caller owns sending, stopping, attachments and settings, and decides which actions to show.',
      },
    },
  },
} satisfies Meta<typeof ComposerSendButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Send: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Send message' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
export const SendOutline: Story = { args: { appearance: 'outline' } };
export const Disabled: Story = { args: { disabled: true } };
export const Stop: Story = {
  render: args => <ComposerStopButton {...args} aria-label="Stop response" />,
};
export const StopOutline: Story = { ...Stop, args: { appearance: 'outline' } };
export const Attachment: Story = {
  render: args => <ComposerAttachmentButton {...args} aria-label="Add attachment" />,
};
export const AttachmentOutline: Story = { ...Attachment, args: { appearance: 'outline' } };
export const Settings: Story = {
  render: () => <ComposerModelSettingsButton />,
};
export const SendAndStop: Story = {
  render: args => (
    <ButtonsGroup spacing="close">
      <ComposerAttachmentButton appearance={args.appearance} aria-label="Add attachment" />
      <ComposerStopButton appearance={args.appearance} aria-label="Stop response" />
      <ComposerSendButton {...args} />
    </ButtonsGroup>
  ),
};
