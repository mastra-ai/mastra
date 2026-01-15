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
        'flex ',
        '[&>a]:flex [&>a]:items-center [&>a]:min-h-[2rem] [&>a]:gap-[10px] [&>a]:text-ui-sm [&>a]:text-neutral3 [&>a]:py-[6px] [&>a]:px-[0.75rem] [&>a]:w-full [&>a]:rounded-lg [&>a]:justify-center',
        '[&_svg]:w-[1rem] [&_svg]:h-[1rem] [&_svg]:text-neutral3/60',
        '[&>a:hover]:bg-surface4 [&>a:hover]:text-neutral5 [&>a:hover_svg]:text-neutral3',
        {
          '[&>a]:text-neutral5 [&>a]:bg-surface3': isActive,
          '[&_svg]:text-neutral5': isActive,
          '[&>a]:justify-start ': !isCollapsed,
          '[&_svg]:text-neutral3': isCollapsed,
          '[&>a]:rounded-md [&>a]:my-[0.5rem] [&>a]:bg-accent1/75 [&>a:hover]:bg-accent1/85 [&>a]:text-black [&>a:hover]:text-black':
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
              <TooltipContent side="right" align="center" className="bg-border1 text-neutral6 ml-[1rem]">
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
