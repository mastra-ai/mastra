import { useRender } from '@base-ui/react/use-render';
import { useTableVariant } from './table-context';
import { tableRowTargetStyles } from './table-row-target';
import { cn } from '@/lib/utils';

export type TableRowLinkProps = useRender.ComponentProps<'a'>;

export function TableRowLink({ render, className, ...props }: TableRowLinkProps) {
  const variant = useTableVariant();
  return useRender({
    defaultTagName: 'a',
    render,
    props: {
      ...props,
      'data-slot': 'table-row-link',
      'data-row-target': '',
      className: cn(...tableRowTargetStyles(variant), className),
    },
  });
}
