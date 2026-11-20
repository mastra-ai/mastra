import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import * as AskUserPrimitive from './ask-user';
import { AskUser } from './ask-user';
import type { AskUserProps } from './ask-user';

const meta: Meta<typeof AskUser> = {
  title: 'AI/Ask User',
  component: AskUser,
  args: { onSubmit: fn() },
  decorators: [
    Story => (
      <div className="w-full max-w-3xl p-4">
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

export const SingleSelectCustomAnswer: Story = {
  ...SingleSelect,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('group', { name: 'Custom answer' }));
    await userEvent.click(canvas.getByText('Choose a deployment target'));
    await expect(canvas.getByRole('radio', { name: 'Other…' })).not.toBeChecked();
    await expect(canvas.queryByRole('textbox', { name: 'Your answer' })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('group', { name: 'Custom answer' }));
    const input = canvas.getByRole('textbox', { name: 'Your answer' });
    await expect(input).toHaveFocus();
    await userEvent.type(input, 'Staging, using the isolated customer environment.');
    await userEvent.keyboard('{Enter}');
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledWith('Staging, using the isolated customer environment.');
  },
};

export const MultiSelectCustomAnswer: Story = {
  ...MultiSelect,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Typecheck' }));
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Other…' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your answer' }), '   ');
    await userEvent.click(canvas.getByText('Select verification steps'));
    await expect(canvas.getByRole('checkbox', { name: 'Other…' })).not.toBeChecked();
    await expect(canvas.getByRole('checkbox', { name: 'Typecheck' })).toBeChecked();
    await expect(canvas.getByRole('button', { name: 'Submit answer' })).toBeEnabled();
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Other…' }));
    await userEvent.clear(canvas.getByRole('textbox', { name: 'Your answer' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your answer' }), 'Check the customer environment.');
    await userEvent.click(canvas.getByRole('button', { name: 'Submit answer' }));
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledWith(['Typecheck', 'Check the customer environment.']);
  },
};

function ComposedQuestionStory({ payload, isSubmitting, onSubmit }: AskUserProps) {
  const isMultiSelect = payload.selectionMode === 'multi_select';

  return (
    <AskUserPrimitive.Root selectionMode={payload.selectionMode} disabled={isSubmitting} onSubmit={onSubmit}>
      <AskUserPrimitive.Body>
        <AskUserPrimitive.Question>{payload.question}</AskUserPrimitive.Question>
        <AskUserPrimitive.Options>
          {payload.options?.map(option => (
            <AskUserPrimitive.Option key={option.label} value={option.label} description={option.description}>
              {option.label}
            </AskUserPrimitive.Option>
          ))}
          <AskUserPrimitive.CustomAnswer />
        </AskUserPrimitive.Options>
        <div className="mt-3 flex justify-end">
          <AskUserPrimitive.Submit when={isMultiSelect ? 'always' : 'custom-answer'} />
        </div>
      </AskUserPrimitive.Body>
    </AskUserPrimitive.Root>
  );
}

export const ComposedSingleSelect: Story = {
  ...SingleSelectCustomAnswer,
  render: args => <ComposedQuestionStory {...args} />,
};

export const ComposedMultiSelect: Story = {
  ...MultiSelectCustomAnswer,
  render: args => <ComposedQuestionStory {...args} />,
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
