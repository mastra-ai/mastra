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
          'Byte sizes use binary 1024-based conversions, not decimal SI units. Byte-only calls keep their existing automatic formatting. With a source `unit`, values stay in that unit unless `autoScale: true`. Returns `undefined` for negative, non-finite, or missing input. Import from `@mastra/playground-ui/utils/number`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SourceUnits: Story = {
  name: 'Source units',
  args: {
    examples: [
      ["formatBytes(0.5, { unit: 'GB' })", formatBytes(0.5, { unit: 'GB' })],
      ["formatBytes(0.5, { unit: 'GB', autoScale: false })", formatBytes(0.5, { unit: 'GB', autoScale: false })],
      ["formatBytes(0.5, { unit: 'GB', autoScale: true })", formatBytes(0.5, { unit: 'GB', autoScale: true })],
      ["formatBytes(2048, { unit: 'GB', autoScale: false })", formatBytes(2048, { unit: 'GB', autoScale: false })],
      ["formatBytes(2048, { unit: 'GB', autoScale: true })", formatBytes(2048, { unit: 'GB', autoScale: true })],
      ["formatBytes(1023.5, { unit: 'MB', autoScale: true })", formatBytes(1023.5, { unit: 'MB', autoScale: true })],
      ["formatBytes(0, { unit: 'GB' })", formatBytes(0, { unit: 'GB' })],
      ["formatBytes(0, { unit: 'GB', autoScale: true })", formatBytes(0, { unit: 'GB', autoScale: true })],
    ],
  },
};
