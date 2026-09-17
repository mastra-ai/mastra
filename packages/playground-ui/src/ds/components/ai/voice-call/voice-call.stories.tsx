import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { VoiceCallButton } from './voice-call-button';
import { VoiceCallPanel } from './voice-call-panel';
const meta = {
  title: 'AI/Voice call',
  component: VoiceCallButton,
  args: { status: 'idle', available: true, onStart: fn(), onStop: fn() },
} satisfies Meta<typeof VoiceCallButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = {};
export const Unavailable: Story = { args: { available: false } };
export const Connecting: Story = {
  args: { status: 'connecting' },
  render: args => (
    <>
      <VoiceCallPanel status="connecting" agentState="initializing" captions={[]} />
      <VoiceCallButton {...args} />
    </>
  ),
};
export const Listening: Story = {
  args: { status: 'active' },
  render: args => (
    <>
      <VoiceCallPanel status="active" agentState="listening" captions={[]} />
      <VoiceCallButton {...args} />
    </>
  ),
};
export const Thinking: Story = {
  args: { status: 'active' },
  render: args => (
    <>
      <VoiceCallPanel
        status="active"
        agentState="thinking"
        captions={[{ id: 'user', role: 'user', text: 'Can you review the keyboard interactions?', final: true }]}
      />
      <VoiceCallButton {...args} />
    </>
  ),
};
export const Speaking: Story = {
  args: { status: 'active' },
  render: args => (
    <>
      <VoiceCallPanel
        status="active"
        agentState="speaking"
        captions={[
          { id: 'user', role: 'user', text: 'Can you review the keyboard interactions?', final: true },
          { id: 'agent', role: 'agent', text: 'I will check sending, focus, and attachment previews.', final: false },
        ]}
      />
      <VoiceCallButton {...args} />
    </>
  ),
};
