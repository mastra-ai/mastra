import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatDurationPrecise } from '@/utils/duration';

const examples: HelperExample[] = [
  ['formatDurationPrecise(123.4)', formatDurationPrecise(123.4)],
  ['formatDurationPrecise(1_234)', formatDurationPrecise(1_234)],
  ['formatDurationPrecise(-1)', formatDurationPrecise(-1)],
];

const meta = {
  title: 'Helpers/formatDurationPrecise',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Millisecond-precise duration for span timelines. Import from `@mastra/playground-ui/utils/duration`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
