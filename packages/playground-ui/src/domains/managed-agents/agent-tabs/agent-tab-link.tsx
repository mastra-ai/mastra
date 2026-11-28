import type { ReactNode } from 'react';
import { buttonVariants } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

export function AgentTabLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  const { Link } = useLinkComponent();
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'md' }),
        'shrink-0 gap-1.5',
        active && 'bg-fill text-foreground',
      )}
    >
      <Icon size="xs">{icon}</Icon>
      <Txt as="span" variant="caption" className="text-inherit">
        {label}
      </Txt>
    </Link>
  );
}
