import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatPercent } from '@/utils/number';

const examples: HelperExample[] = [
  ['formatPercent(0.42)', formatPercent(0.42)],
  ['formatPercent(0.4256)', formatPercent(0.4256)],
  ['formatPercent(1.5)', formatPercent(1.5)],
  ['formatPercent(-0.12)', formatPercent(-0.12)],
  ['formatPercent(0.0004)', formatPercent(0.0004)],
  ['formatPercent(0)', formatPercent(0)],
  ['formatPercent(0.123, { signed: true })', formatPercent(0.123, { signed: true })],
];

const meta = {
  title: 'Helpers/formatPercent',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Formats a ratio as a percentage with up to one decimal. Pass `0.42`, not `42`. Tiny non-zero ratios show `<0.1%` instead of rounding to `0%`. `signed: true` adds a `+` for changes. Import from `@mastra/playground-ui/utils/number`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
