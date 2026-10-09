import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatCompactNumber } from '@/utils/cost';

const examples: HelperExample[] = [
  ['formatCompactNumber(12_310)', formatCompactNumber(12_310)],
  ['formatCompactNumber(6_000)', formatCompactNumber(6_000)],
  ['formatCompactNumber(1_284_170)', formatCompactNumber(1_284_170)],
  ["formatCompactNumber(4.37, { currency: 'USD' })", formatCompactNumber(4.37, { currency: 'USD' })],
  ["formatCompactNumber(128.4, { currency: 'USD' })", formatCompactNumber(128.4, { currency: 'USD' })],
];

const meta = {
  title: 'Helpers/formatCompactNumber',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'About three significant digits, compact. Pass `currency` for money. To render a quantity, prefer `CompactNumber`, which adds the exact value on hover. Import from `@mastra/playground-ui/utils/cost`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
