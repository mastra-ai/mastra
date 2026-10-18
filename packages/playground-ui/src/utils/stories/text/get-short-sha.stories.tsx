import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { getShortSha } from '@/utils/id';

const examples: HelperExample[] = [
  ["getShortSha('79f36ef97e4b1c2d3e4f5a6b7c8d9e0f1a2b3c4d')", getShortSha('79f36ef97e4b1c2d3e4f5a6b7c8d9e0f1a2b3c4d')],
  ['getShortSha(undefined)', getShortSha(undefined)],
];

const meta = {
  title: 'Helpers/getShortSha',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'First 7 characters of a git commit SHA, matching how GitHub abbreviates commits. Import from `@mastra/playground-ui/utils/id`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
