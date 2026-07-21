import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AskUser } from './ask-user';

const meta: Meta<typeof AskUser> = {
  title: 'AI/Ask User',
  component: AskUser,
  args: { onSubmit: fn() },
  decorators: [
    Story => (
      <div className="w-full max-w-lg p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof AskUser>;

export const FreeText: Story = {
  args: { payload: { question: 'What should the agent prioritize?' } },
};

export const SingleSelect: Story = {
  args: {
    payload: {
      question: 'Choose a deployment target',
      selectionMode: 'single_select',
      options: [
        { label: 'Staging', description: 'Validate the release before production.' },
        { label: 'Production', description: 'Deploy directly to users.' },
      ],
    },
  },
};

export const MultiSelect: Story = {
  args: {
    payload: {
      question: 'Select verification steps',
      selectionMode: 'multi_select',
      options: [{ label: 'Unit tests' }, { label: 'Typecheck' }, { label: 'Build' }],
    },
  },
};

export const Submitting: Story = {
  args: {
    payload: { question: 'Choose a deployment target', options: [{ label: 'Staging' }, { label: 'Production' }] },
    isSubmitting: true,
  },
};

export const Answered: Story = {
  args: {
    payload: { question: 'Choose a deployment target' },
    result: { content: 'User answered: Staging' },
  },
};

export const Error: Story = {
  args: {
    payload: { question: 'Choose a deployment target' },
    result: { content: 'The answer could not be submitted.', isError: true },
  },
};
