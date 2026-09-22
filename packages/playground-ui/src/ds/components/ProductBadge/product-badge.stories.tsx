import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProductBadge } from './ProductBadge';

const meta = {
  title: 'Elements/Products/ProductBadge',
  component: ProductBadge,
  args: { product: 'studio' },
  argTypes: {
    product: {
      control: 'select',
      options: ['studio', 'server', 'observability', 'factory', 'workers', 'persistent-server'],
    },
  },
} satisfies Meta<typeof ProductBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
