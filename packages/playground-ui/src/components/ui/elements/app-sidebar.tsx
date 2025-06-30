'use client';

import { cn } from '@/lib/utils';
import { PanelRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export type AppSidebarItem = {
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
};

export type AppSidebarSection = AppSidebarItem[];

export function AppSidebar({
  items,
  className,
  style,
  linkComponent,
  currentPath,
}: {
  items: AppSidebarSection[];
  className?: string;
  style?: React.CSSProperties;
  linkComponent?: React.ElementType;
  currentPath?: string;
}) {
  const LinkComponent = linkComponent || null;
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 1024);
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      className={cn('h-full grid grid-rows-[1fr_auto] relative', className)}
      style={{
        ...style,
      }}
    >
      <nav className="px-[10px] pt-[5px] flex flex-col gap-[2px] content-start">
        {items.map((section, idx) => (
          <ul
            key={idx}
            className={cn(
              'grid gap-[2px] items-start content-center relative',
              'after:content-[""] after:absolute after:bottom-[6px] after:left-2 after:right-2 after:h-[1px] after:border-b after:border-border1 pb-[18px]',
              {
                'mt-auto': idx === items.length - 1, // Push the last section to the bottom
              },
            )}
          >
            {section.map((item, itemIdx) => {
              const isActive = item.to ? currentPath?.startsWith(item.to) : false;

              return (
                <li
                  key={itemIdx}
                  className={cn(
                    '[&>a]:flex [&>a]:items-center [&>a]:min-h-[2rem] [&>a]:gap-[10px] [&>a]:text-[13px] [&>a]:text-icon3 [&>a]:py-[6px] [&>a]:px-[8px] [&>a]:rounded-md',
                    '[&>a:hover]:bg-surface4 [&>a:hover]:text-icon5',
                    '[&_svg]:w-[16px] [&_svg]:h-[16px] [&_svg]:text-icon3',
                    {
                      '[&>a]:text-icon5 [&>a]:bg-surface3': isActive,
                      '[&_svg]:text-icon5': isActive,
                    },
                  )}
                >
                  {item.to && LinkComponent && !item.href && (
                    <LinkComponent to={item.to}>
                      {item.icon}
                      {!isCollapsed && (
                        <div className="min-w-[8rem]">
                          {item.label}
                          {item.badge}
                        </div>
                      )}
                    </LinkComponent>
                  )}
                  {item.href && !item.to && (
                    <a href={item.href} target="_blank" rel="noopener noreferrer">
                      {item.icon}
                      {!isCollapsed && (
                        <>
                          {item.label}
                          {item.badge}
                        </>
                      )}
                    </a>
                  )}
                  {(!item.href && !item.to) ||
                    (item.href && item.to && (
                      <>{console.log("'to' or 'href' property is required (AppSidebar item)")}</>
                    ))}
                </li>
              );
            })}
          </ul>
        ))}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'flex items-center gap-[10px] text-[13px] text-icon3 py-[6px] px-[8px] rounded-md justify-between w-full mb-[10px]',
            '[&_svg]:w-[16px] [&_svg]:h-[16px] [&_svg]:text-icon3',
          )}
          aria-label="Toggle sidebar"
        >
          {!isCollapsed && <>Collapse</>}
          <PanelRightIcon
            className={cn({
              'rotate-180': isCollapsed,
            })}
          />
        </button>
      </nav>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn('w-[10px] h-full -right-[5px] top-0 absolute opacity-10', {
          'cursor-w-resize': !isCollapsed,
          'cursor-e-resize': isCollapsed,
        })}
        aria-label="Toggle sidebar"
      ></button>
    </div>
  );
}
