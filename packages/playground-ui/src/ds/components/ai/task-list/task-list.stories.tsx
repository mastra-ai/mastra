import type { Meta, StoryObj } from '@storybook/react-vite';
import { TaskList } from './task-list';

const meta: Meta<typeof TaskList> = {
  title: 'AI/Task List',
  component: TaskList,
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
type Story = StoryObj<typeof TaskList>;

export const MixedProgress: Story = {
  args: {
    tasks: [
      {
        id: 'inspect',
        content: 'Inspect existing components',
        status: 'completed',
        activeForm: 'Inspecting existing components',
      },
      { id: 'tests', content: 'Add component tests', status: 'in_progress', activeForm: 'Adding component tests' },
      { id: 'build', content: 'Build the package', status: 'pending', activeForm: 'Building the package' },
    ],
  },
};

export const OneActiveTask: Story = {
  args: {
    tasks: [
      {
        id: 'implement',
        content: 'Implement the shared primitive',
        status: 'in_progress',
        activeForm: 'Implementing the shared primitive',
      },
    ],
  },
};

export const Empty: Story = {
  args: { tasks: [], hideWhenEmpty: false },
};

export const Completed: Story = {
  args: {
    hideWhenComplete: false,
    tasks: [
      { id: 'tests', content: 'Run tests', status: 'completed', activeForm: 'Running tests' },
      { id: 'build', content: 'Build package', status: 'completed', activeForm: 'Building package' },
    ],
  },
};
