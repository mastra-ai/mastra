import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatFullNumber } from '@/utils/cost';

const examples: HelperExample[] = [
  ['formatFullNumber(12_310)', formatFullNumber(12_310)],
  ["formatFullNumber(1_284.17, { currency: 'USD' })", formatFullNumber(1_284.17, { currency: 'USD' })],
];

const meta = {
  title: 'Helpers/formatFullNumber',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Exact value with separators, for tooltips and detail views. Pass `currency` for money. Import from `@mastra/playground-ui/utils/cost`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
