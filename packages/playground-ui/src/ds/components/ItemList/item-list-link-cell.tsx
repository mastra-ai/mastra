import { transitions, focusRing } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type ItemListLinkCellProps = {
  children?: React.ReactNode;
  className?: string;
  href: string;
  LinkComponent: LinkComponent;
};

export function ItemListLinkCell({ children, href, className, LinkComponent: Link }: ItemListLinkCellProps) {
  return (
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
}
