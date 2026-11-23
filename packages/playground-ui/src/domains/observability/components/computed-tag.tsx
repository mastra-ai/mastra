import { Badge } from '@/ds/components/Badge';
import type { BadgeProps } from '@/ds/components/Badge';
import { hueForName } from '@/utils/colors';

// `BadgeProps` is a union on icon/indicator; tags never use a leading visual, so drop both.
export type ComputedTagProps = Omit<BadgeProps, 'variant' | 'emphasis' | 'style' | 'icon' | 'indicator'> & {
  /** Tag value the colors are derived from. Rendered as label unless children are provided. */
  value: string;
};

/**
 * Tag badge whose background/foreground colors are deterministically computed
 * from its value, so the same tag looks the same everywhere it is displayed.
 */
export function ComputedTag({ value, children, size = 'xs', ...props }: ComputedTagProps) {
  return (
    <Badge data-testid="computed-tag" size={size} variant={hueForName(value)} {...props}>
      {children ?? value}
    </Badge>
  );
}
