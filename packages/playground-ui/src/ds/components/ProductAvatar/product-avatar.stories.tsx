import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Product } from './product-identity';
import { ProductAvatar } from './ProductAvatar';

const products: Product[] = ['studio', 'server', 'observability', 'factory', 'workers', 'persistent-server'];

const meta = {
  title: 'Elements/Products/ProductAvatar',
  component: ProductAvatar,
  args: { product: 'studio' },
  argTypes: { product: { control: 'select', options: products } },
} satisfies Meta<typeof ProductAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProducts: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      {products.map(product => (
        <ProductAvatar key={product} product={product} />
      ))}
    </div>
  ),
};
