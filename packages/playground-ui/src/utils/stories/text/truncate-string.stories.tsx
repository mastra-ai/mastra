import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { truncateString } from '@/utils/truncate-string';

const examples: HelperExample[] = [
  ["truncateString('Summarize the latest deploy logs', 16)", truncateString('Summarize the latest deploy logs', 16)],
  ["truncateString('Short', 16)", truncateString('Short', 16)],
];

const meta = {
  title: 'Helpers/truncateString',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Cuts a string to `maxLength` characters and appends an ellipsis when it was longer. Import from `@mastra/playground-ui/utils/truncate-string`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
