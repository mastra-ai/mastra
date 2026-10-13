import { useRender } from '@base-ui/react/use-render';
import { cn } from '@/lib/utils';

export type TableRowLinkProps = useRender.ComponentProps<'a'>;

const tableRowLinkStyles = [
  "outline-none after:absolute after:inset-0 after:content-['']",
  'focus-visible:after:outline-1 focus-visible:after:-outline-offset-1 focus-visible:after:outline-border-focus focus-visible:after:outline-solid',
] as const;

export function TableRowLink({ render, className, ...props }: TableRowLinkProps) {
  return useRender({
    defaultTagName: 'a',
    render,
    props: { ...props, 'data-slot': 'table-row-link', className: cn(...tableRowLinkStyles, className) },
  });
}
