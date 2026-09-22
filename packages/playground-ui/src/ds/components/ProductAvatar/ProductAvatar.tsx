import type { HTMLAttributes } from 'react';
import { productColors, productNames } from './product-identity';
import type { Product } from './product-identity';
import { ProductIcon } from './ProductIcon';
import { cn } from '@/lib/utils';
import './product-avatar.css';

export type ProductAvatarProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & { product: Product };

export function ProductAvatar({ product, className, ...props }: ProductAvatarProps) {
  return (
    <span
      role="img"
      aria-label={productNames[product]}
      className={cn(
        'product-avatar inline-flex size-5 shrink-0 items-center justify-center rounded-full',
        productColors[product],
        className,
      )}
      {...props}
    >
      <ProductIcon product={product} />
    </span>
  );
}
