import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatCost } from '@/utils/cost';

const examples: HelperExample[] = [
  ['formatCost(4.37)', formatCost(4.37)],
  ['formatCost(0.004)', formatCost(0.004)],
  ['formatCost(128.4)', formatCost(128.4)],
];

const meta = {
  title: 'Helpers/formatCost',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Cost with an optional unit, showing `<$0.01` for tiny amounts. Import from `@mastra/playground-ui/utils/cost`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
