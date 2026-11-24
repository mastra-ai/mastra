import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '../Avatar/Avatar';
import type { AvatarSize } from '../Avatar/avatar-size';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../Tooltip/tooltip';
import type { Product } from './product-identity';
import { ProductAvatar } from './ProductAvatar';

const products: Product[] = ['studio', 'server', 'observability', 'factory', 'workers', 'persistent-server'];
const sizes: AvatarSize[] = ['xs', 'inline', 'sm', 'md', 'lg', 'control'];

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

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-4">
      {sizes.map(size => (
        <ProductAvatar key={size} product="studio" size={size} />
      ))}
    </div>
  ),
};

export const InGroup: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-4">
      {sizes.map(size => (
        <Avatar.Group key={size} size={size}>
          {products.map(product => (
            <ProductAvatar key={product} product={product} />
          ))}
        </Avatar.Group>
      ))}
    </div>
  ),
};

export const InGroupWithCount: Story = {
  render: () => (
    <Avatar.Group size="md" className="p-4">
      <ProductAvatar product="studio" />
      <ProductAvatar product="server" />
      <ProductAvatar product="observability" />
      <Avatar.GroupCount>+3</Avatar.GroupCount>
    </Avatar.Group>
  ),
};

export const MixedWithAvatars: Story = {
  render: () => (
    <Avatar.Group size="md" className="p-4">
      <Avatar name="Jane Smith" />
      <ProductAvatar product="studio" />
      <Avatar name="Sam Lee" />
      <ProductAvatar product="observability" />
      <Avatar.GroupCount>+2</Avatar.GroupCount>
    </Avatar.Group>
  ),
};

export const InGroupWithTooltips: Story = {
  render: () => (
    <TooltipProvider>
      <Avatar.Group size="md" className="p-4">
        {products.slice(0, 3).map(product => (
          <Tooltip key={product}>
            <TooltipTrigger render={<ProductAvatar product={product} />} />
            <TooltipContent side="top">{product}</TooltipContent>
          </Tooltip>
        ))}
        <Avatar.GroupCount>+3</Avatar.GroupCount>
      </Avatar.Group>
    </TooltipProvider>
  ),
};
