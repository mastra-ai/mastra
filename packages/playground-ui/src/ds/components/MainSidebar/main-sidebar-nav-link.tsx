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
  isOnMastraPlatform: boolean;
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
        'flex relative',
        // Base link styles with smooth transitions
        '[&>a]:flex [&>a]:items-center [&>a]:min-h-8 [&>a]:gap-2.5 [&>a]:text-ui-md [&>a]:text-neutral3 [&>a]:py-1.5 [&>a]:px-3 [&>a]:w-full [&>a]:rounded-lg [&>a]:justify-center',
        '[&>a]:transition-all [&>a]:duration-normal [&>a]:ease-out-custom',
        // Icon styles with transitions
        '[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-neutral3/60 [&_svg]:transition-colors [&_svg]:duration-normal',
        // Hover states
        '[&>a:hover]:bg-surface4 [&>a:hover]:text-neutral5 [&>a:hover_svg]:text-neutral3',
        {
          // Active state with left indicator bar
          '[&>a]:text-neutral5 [&>a]:bg-surface3': isActive,
          '[&_svg]:text-neutral5': isActive,
          // Active indicator bar
          'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-0.5 before:h-5 before:bg-accent1 before:rounded-r-full before:transition-all before:duration-normal':
            isActive && !isCollapsed,
          '[&>a]:justify-start': !isCollapsed,
          '[&_svg]:text-neutral3': isCollapsed,
          // Featured variant
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
