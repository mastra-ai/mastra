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
        'w-full px-3 py-[0.6rem] gap-6 text-left items-center rounded-lg flex justify-center',
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
