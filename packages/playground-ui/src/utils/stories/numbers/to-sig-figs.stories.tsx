import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { toSigFigs } from '@/utils/number';

const examples: HelperExample[] = [
  ['toSigFigs(3.14159, 3)', toSigFigs(3.14159, 3)],
  ['toSigFigs(12_345, 2)', toSigFigs(12_345, 2)],
  ['toSigFigs(0.000_456_7, 2)', toSigFigs(0.000_456_7, 2)],
];

const meta = {
  title: 'Helpers/toSigFigs',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Rounds to a number of significant figures. Import from `@mastra/playground-ui/utils/number`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
