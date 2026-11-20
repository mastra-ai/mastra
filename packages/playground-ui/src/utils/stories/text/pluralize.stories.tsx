import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { pluralize } from '@/utils/string';

const examples: HelperExample[] = [
  ["pluralize(1, 'deploy')", pluralize(1, 'deploy')],
  ["pluralize(3, 'deploy')", pluralize(3, 'deploy')],
  ["pluralize(0, 'deploy')", pluralize(0, 'deploy')],
  ["pluralize(1_204, 'line')", pluralize(1_204, 'line')],
  ["pluralize(3, 'entry', 'entries')", pluralize(3, 'entry', 'entries')],
];

const meta = {
  title: 'Helpers/pluralize',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A count with its noun in the right form: `1 deploy`, `3 deploys`. Pass the plural for irregular nouns. The count gets thousands separators. Import from `@mastra/playground-ui/utils/string`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
