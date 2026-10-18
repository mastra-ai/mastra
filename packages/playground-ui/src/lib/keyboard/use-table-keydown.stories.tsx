import type { Meta, StoryObj } from '@storybook/react-vite';

import { TableNavigation } from './use-keydown.stories';

const meta = {
  title: 'Hooks/useTableKeydown',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Roving row focus with Arrow, Page, Home/End, and activation handlers. Import from `@mastra/playground-ui/keyboard/use-keydown`. This reuses the table navigation demo from useKeydown.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = TableNavigation;
