import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProductBadge } from '../ProductBadge/ProductBadge';
import type { Product } from './product-identity';
import { ProductAvatar } from './ProductAvatar';

const products: Product[] = ['studio', 'server', 'observability', 'factory', 'workers', 'persistent-server'];

const meta = {
  title: 'Elements/Products',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      {products.map(product => (
        <div key={product} className="flex items-center gap-4">
          <ProductAvatar product={product} />
          <ProductBadge product={product} />
        </div>
      ))}
    </div>
  ),
};
