import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeProps } from '@mastra/playground-ui/components/Badge';
import { stringToColor } from '@mastra/playground-ui/utils/colors';
import { useMemo } from 'react';

export type ComputedTagProps = Omit<BadgeProps, 'variant' | 'emphasis' | 'style'> & {
  /** Tag value the colors are derived from. Rendered as label unless children are provided. */
  value: string;
};

/**
 * Tag badge whose background/foreground colors are deterministically computed
 * from its value, so the same tag looks the same everywhere it is displayed.
 */
export function ComputedTag({ value, children, size = 'xs', ...props }: ComputedTagProps) {
  const style = useMemo(() => ({ backgroundColor: stringToColor(value), color: stringToColor(value, 25) }), [value]);

  return (
    <Badge data-testid="computed-tag" size={size} style={style} {...props}>
      {children ?? value}
    </Badge>
  );
}
