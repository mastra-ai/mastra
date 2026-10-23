import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatBytes } from '@/utils/number';

const examples: HelperExample[] = [
  ['formatBytes(512)', formatBytes(512)],
  ['formatBytes(1536)', formatBytes(1536)],
  ['formatBytes(10 * 1024 + 300)', formatBytes(10 * 1024 + 300)],
  ['formatBytes(125 * 1024 ** 2)', formatBytes(125 * 1024 ** 2)],
  ['formatBytes(2.25 * 1024 ** 3)', formatBytes(2.25 * 1024 ** 3)],
  ['formatBytes(-1)', formatBytes(-1)],
];

const meta = {
  title: 'Helpers/formatBytes',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Binary byte size: `512 B`, `1.5 KB`, `125 MB`. Values under 10 keep one decimal. Returns `undefined` for negative or non-finite input. Import from `@mastra/playground-ui/utils/number`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
