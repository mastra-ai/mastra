import { useContext } from 'react';
import type { HTMLAttributes } from 'react';
import { AvatarSizeContext, avatarSizeClasses } from '../Avatar/avatar-size';
import type { AvatarSize } from '../Avatar/avatar-size';
import { productAvatarDefaultClasses, productAvatarIconClasses } from './product-avatar-size';
import { productColors, productNames } from './product-identity';
import type { Product } from './product-identity';
import { ProductIcon } from './ProductIcon';
import { cn } from '@/lib/utils';

export type ProductAvatarProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  product: Product;
  size?: AvatarSize;
};

export function ProductAvatar({ product, size, className, ...props }: ProductAvatarProps) {
  const contextSize = useContext(AvatarSizeContext);
  const resolvedSize = size ?? contextSize;

  return (
    <span
      role="img"
      aria-label={productNames[product]}
      data-slot="avatar"
      data-size={resolvedSize}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:shadow-inset',
        resolvedSize
          ? [avatarSizeClasses[resolvedSize], productAvatarIconClasses[resolvedSize]]
          : productAvatarDefaultClasses,
        productColors[product],
        className,
      )}
      {...props}
    >
      <ProductIcon product={product} />
    </span>
  );
}
