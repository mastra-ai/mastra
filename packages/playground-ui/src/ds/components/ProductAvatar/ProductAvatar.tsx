import type { HTMLAttributes } from 'react';
import { productColors, productNames } from './product-identity';
import type { Product } from './product-identity';
import { ProductIcon } from './ProductIcon';
import { cn } from '@/lib/utils';

export type ProductAvatarProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & { product: Product };

export function ProductAvatar({ product, className, ...props }: ProductAvatarProps) {
  return (
    <span
      role="img"
      aria-label={productNames[product]}
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full shadow-inset [&>svg]:size-icon-xs',
        productColors[product],
        className,
      )}
      {...props}
    >
      <ProductIcon product={product} />
    </span>
  );
}
