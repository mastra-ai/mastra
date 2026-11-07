import { MoreHorizontalIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';

import { Icon } from '../../icons/Icon';
import { SlashIcon } from '../../icons/SlashIcon';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

type HiddenCrumb = {
  label: string;
  link?: HTMLAnchorElement;
};

function hiddenCrumbsOf(list: HTMLOListElement | null | undefined): HiddenCrumb[] {
  if (!list) return [];
  const crumbs = Array.from(list.querySelectorAll<HTMLLIElement>(':scope > li[data-slot="crumb"]'));
  return crumbs.slice(0, -2).flatMap(crumb => {
    const label = crumb.querySelector('[data-slot="crumb-label"]')?.textContent?.trim();
    if (!label) return [];
    return [{ label, link: crumb.querySelector<HTMLAnchorElement>('a[href]') ?? undefined }];
  });
}

function followCrumbLink(event: MouseEvent<HTMLAnchorElement>, link: HTMLAnchorElement) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  link.click();
}

export function BreadcrumbOverflow() {
  const itemRef = useRef<HTMLLIElement>(null);
  const [hiddenCrumbs, setHiddenCrumbs] = useState<HiddenCrumb[]>([]);

  return (
    <>
      <li ref={itemRef} data-breadcrumb-overflow className="hidden h-control-sm shrink-0 items-center">
        <DropdownMenu
          onOpenChange={open => {
            if (open) setHiddenCrumbs(hiddenCrumbsOf(itemRef.current?.closest('ol')));
          }}
        >
          <DropdownMenu.Trigger variant="ghost" size="icon-sm" aria-label="Show the full path">
            <MoreHorizontalIcon />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start" className="max-w-72">
            {hiddenCrumbs.map(({ label, link }) =>
              link ? (
                <DropdownMenu.LinkItem
                  key={label}
                  href={link.getAttribute('href') ?? undefined}
                  closeOnClick
                  onClick={event => followCrumbLink(event, link)}
                >
                  <span className="truncate">{label}</span>
                </DropdownMenu.LinkItem>
              ) : (
                <DropdownMenu.Item key={label} disabled>
                  <span className="truncate">{label}</span>
                </DropdownMenu.Item>
              ),
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      </li>
      <li role="separator" data-breadcrumb-overflow className="hidden h-full items-center">
        <Icon className="text-placeholder">
          <SlashIcon />
        </Icon>
      </li>
    </>
  );
}
