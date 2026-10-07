import { Menu } from '@base-ui/react/menu';
import { ChevronDownIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Txt } from '../Txt/Txt';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type DropdownMenuIdentityTriggerProps = Omit<Menu.Trigger.Props, 'children' | 'className'> & {
  className?: string;
  avatar: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  collapsed?: boolean;
};

export function DropdownMenuIdentityTrigger({
  avatar,
  children,
  description,
  collapsed = false,
  className,
  ...props
}: DropdownMenuIdentityTriggerProps) {
  return (
    <Menu.Trigger
      {...props}
      data-slot="dropdown-menu-identity-trigger"
      className={cn(
        'flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left',
        'not-disabled:hover:bg-fill-subtle disabled:cursor-not-allowed data-[popup-open]:bg-fill-subtle',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        'data-[popup-open]:[&>svg]:rotate-180',
        collapsed && 'justify-center',
        controlStateColorTransition,
        className,
      )}
    >
      {avatar}
      {!collapsed && (
        <>
          <span className="flex min-w-0 flex-1 flex-col">
            <Txt as="span" variant="label" className="truncate">
              {children}
            </Txt>
            {description && (
              <Txt as="span" variant="meta" tone="muted" className="truncate">
                {description}
              </Txt>
            )}
          </span>
          <ChevronDownIcon className="size-icon-md shrink-0 text-muted-foreground" />
        </>
      )}
    </Menu.Trigger>
  );
}
