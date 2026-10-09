import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { getShortId } from '@/utils/id';

const examples: HelperExample[] = [
  ["getShortId('3f2a9c1e-7b4d-4e8a-9c2f-1d6b8e0a4f7c')", getShortId('3f2a9c1e-7b4d-4e8a-9c2f-1d6b8e0a4f7c')],
  ["getShortId('run_01J8Z4K7QW')", getShortId('run_01J8Z4K7QW')],
  ['getShortId(undefined)', getShortId(undefined)],
];

const meta = {
  title: 'Helpers/getShortId',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'First 8 characters of an ID, for tables, breadcrumbs, and labels where the full UUID does not fit. `ItemList` and `DataList` ID cells use it. Import from `@mastra/playground-ui/utils/id`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
