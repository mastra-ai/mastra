import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type ItemListLinkCellProps = {
  children?: React.ReactNode;
  className?: string;
  href: string;
  LinkComponent: LinkComponent;
  tooltip?: React.ReactNode;
};

export function ItemListLinkCell({ children, href, className, LinkComponent: Link, tooltip }: ItemListLinkCellProps) {
  const link = (
    <Link
      href={href}
      className={cn(
        'flex w-full items-center justify-center gap-6 rounded-lg px-3 py-[0.6rem] text-left',
        'hover:bg-surface4',
        transitions.colors,
        focusRing.visible,

        className,
      )}
    >
      {children}
    </Link>
  );

  if (tooltip == null) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
