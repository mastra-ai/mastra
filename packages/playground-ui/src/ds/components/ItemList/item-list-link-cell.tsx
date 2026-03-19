import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';
import { focusRing } from '@/ds/primitives/transitions';
import { useLinkComponent } from '@/lib/framework';

export type ItemListLinkCellProps = {
  children?: React.ReactNode;
  className?: string;
  href: string;
};

export function ItemListLinkCell({ children, href, className }: ItemListLinkCellProps) {
  const { Link } = useLinkComponent();

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
