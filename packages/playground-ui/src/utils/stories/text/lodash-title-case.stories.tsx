import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { lodashTitleCase } from '@/utils/string';

const examples: HelperExample[] = [
  ["lodashTitleCase('weatherAgent')", lodashTitleCase('weatherAgent')],
  ["lodashTitleCase('get_current_weather')", lodashTitleCase('get_current_weather')],
  ["lodashTitleCase('fetch-user-profile')", lodashTitleCase('fetch-user-profile')],
];

const meta = {
  title: 'Helpers/lodashTitleCase',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Title-cases an identifier or phrase, splitting on case changes, spaces, dashes, and underscores. Import from `@mastra/playground-ui/utils/string`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
