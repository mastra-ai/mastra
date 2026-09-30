import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatDuration } from '@/utils/duration';

const examples: HelperExample[] = [
  ['formatDuration(412)', formatDuration(412)],
  ['formatDuration(3_420)', formatDuration(3_420)],
  ['formatDuration(125_000)', formatDuration(125_000)],
  ['formatDuration(4_800_000)', formatDuration(4_800_000)],
  ['formatDuration(97_200_000)', formatDuration(97_200_000)],
  ['formatDuration(-1_500, { signed: true })', formatDuration(-1_500, { signed: true })],
  ['formatDuration(-1_500)', formatDuration(-1_500)],
];

const meta = {
  title: 'Helpers/formatDuration',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Compact duration from milliseconds: `412ms`, `3.42s`, `2m 5s`, `1h 20m`. `signed: true` adds a sign for deltas. Import from `@mastra/playground-ui/utils/duration`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
