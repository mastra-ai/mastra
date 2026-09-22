import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatSkill } from '../chat-skill';

const meta = {
  title: 'AI/Chat events/Skill',
  component: ChatSkill,
  args: {
    name: 'factory-build',
    instructions: 'Implement the approved plan.\n\n- Preserve keyboard access.\n- Verify the attachment previews.',
  },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Skill activation used by Factory. The application parses the skill message; playground-ui owns the disclosure, markdown instructions and bounded scrolling.',
      },
    },
  },
} satisfies Meta<typeof ChatSkill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};
export const Expanded: Story = { args: { defaultOpen: true } };
export const WithArguments: Story = {
  args: { name: 'factory-review', arguments: 'https://github.com/mastra-ai/mastra/pull/24263', defaultOpen: true },
};
export const LongInstructions: Story = {
  args: {
    instructions: Array.from(
      { length: 20 },
      (_, index) => `${index + 1}. Verify keyboard navigation, attachments and streaming in the conversation.`,
    ).join('\n\n'),
    defaultOpen: true,
  },
};
