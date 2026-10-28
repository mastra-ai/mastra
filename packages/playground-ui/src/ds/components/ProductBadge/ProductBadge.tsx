import type { HTMLAttributes } from 'react';
import { Badge } from '../Badge/Badge';
import { productNames } from '../ProductAvatar/product-identity';
import type { Product } from '../ProductAvatar/product-identity';
import { ProductIcon } from '../ProductAvatar/ProductIcon';
import { cn } from '@/lib/utils';
import './product-badge.css';

export type ProductBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & { product: Product };

export function ProductBadge({ product, className, ...props }: ProductBadgeProps) {
  return (
    <Badge
      variant={product}
      icon={<ProductIcon product={product} />}
      className={cn('product-badge', className)}
      {...props}
    >
      {productNames[product]}
    </Badge>
  );
}
