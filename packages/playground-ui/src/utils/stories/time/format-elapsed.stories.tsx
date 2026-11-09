import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatElapsed } from '@/utils/duration';

const examples: HelperExample[] = [
  ['formatElapsed(3_200)', formatElapsed(3_200)],
  ['formatElapsed(12_050)', formatElapsed(12_050)],
];

const meta = {
  title: 'Helpers/formatElapsed',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Live counter label with one fixed decimal, so the width stays stable while it ticks. Import from `@mastra/playground-ui/utils/duration`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
