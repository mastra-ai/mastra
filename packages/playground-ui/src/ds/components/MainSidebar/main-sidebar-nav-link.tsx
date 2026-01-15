import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { type SidebarState } from './main-sidebar-context';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

export type NavLink = {
  name: string;
  url: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  variant?: 'default' | 'featured';
  tooltipMsg?: string;
};

export type MainSidebarNavLinkProps = {
  link?: NavLink;
  isActive?: boolean;
  state?: SidebarState;
  children?: React.ReactNode;
  className?: string;
};
export function MainSidebarNavLink({
  link,
  state = 'default',
  children,
  isActive,
  className,
}: MainSidebarNavLinkProps) {
  const { Link } = useLinkComponent();
  const isCollapsed = state === 'collapsed';
  const isFeatured = link?.variant === 'featured';
  const linkParams = link?.url?.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {};

  return (
    <li
      className={cn(
        'flex',
        '[&>a]:flex [&>a]:items-center [&>a]:min-h-8 [&>a]:gap-2.5 [&>a]:text-ui-md [&>a]:text-neutral3 [&>a]:py-1.5 [&>a]:px-3 [&>a]:w-full [&>a]:rounded-lg [&>a]:justify-center',
        '[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-neutral3/60',
        '[&>a:hover]:bg-surface4 [&>a:hover]:text-neutral5 [&>a:hover_svg]:text-neutral3',
        {
          '[&>a]:text-neutral5 [&>a]:bg-surface3': isActive,
          '[&_svg]:text-neutral5': isActive,
          '[&>a]:justify-start': !isCollapsed,
          '[&_svg]:text-neutral3': isCollapsed,
          '[&>a]:rounded-md [&>a]:my-2 [&>a]:bg-accent1/75 [&>a:hover]:bg-accent1/85 [&>a]:text-black [&>a:hover]:text-black':
            isFeatured,
          '[&_svg]:text-black/75 [&>a:hover_svg]:text-black': isFeatured,
        },
        className,
      )}
    >
      {link ? (
        <>
          {isCollapsed || link.tooltipMsg ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={link.url} {...linkParams}>
                  {link.icon && link.icon}
                  {isCollapsed ? <VisuallyHidden>{link.name}</VisuallyHidden> : link.name} {children}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" className="bg-border1 text-neutral6 ml-4">
                {link.tooltipMsg ? (
                  <>
                    {isCollapsed && `${link.name} | `} {link.tooltipMsg}
                  </>
                ) : (
                  link.name
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href={link.url} {...linkParams}>
              {link.icon && link.icon}
              {isCollapsed ? <VisuallyHidden>{link.name}</VisuallyHidden> : link.name} {children}
            </Link>
          )}
        </>
      ) : (
        children
      )}
    </li>
  );
}
