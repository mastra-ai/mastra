import { MoreHorizontalIcon, Settings2Icon } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { SidebarNavLabel } from '../nav/sidebar-nav-label';
import type { SidebarLink } from '../nav/sidebar-nav-link';
import { SidebarNavLink } from '../nav/sidebar-nav-link';
import { useMaybeSidebarState } from '../root/sidebar-context';
import { SidebarSectionLink } from './sidebar-section-link';
import type { OptionalSidebarLink, SidebarLinkPlacement } from './sidebar-visibility';
import {
  getDefaultPlacement,
  getSidebarLinkKey,
  isSidebarLinkPlacement,
  sidebarLinkPlacementLabels,
  sidebarLinkPlacements,
} from './sidebar-visibility';
import { ContextMenu } from '@/ds/components/ContextMenu';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

export type SidebarMoreLinksProps = {
  links: OptionalSidebarLink[];
  activeCandidates: SidebarLink[];
  isActive?: (link: SidebarLink, activeCandidates: SidebarLink[]) => boolean;
  placementOf: (link: OptionalSidebarLink) => SidebarLinkPlacement;
  onPlacementChange: (link: OptionalSidebarLink, placement: SidebarLinkPlacement) => void;
  onCustomize: () => void;
};

export function SidebarMoreLinks({
  links,
  activeCandidates,
  isActive,
  placementOf,
  onPlacementChange,
  onCustomize,
}: SidebarMoreLinksProps) {
  const context = useMaybeSidebarState();
  const Link = context?.LinkComponent ?? 'a';
  const linkIsActive = (link: SidebarLink) => isActive?.(link, activeCandidates) ?? link.isActive ?? false;
  const shownLinks = links.filter(link => linkIsActive(link) || placementOf(link) === 'sidebar');
  const moreMenuLinks = links.filter(link => !shownLinks.includes(link) && placementOf(link) === 'more');
  const isCustomized = links.some(link => placementOf(link) !== getDefaultPlacement(link, links.length));
  const hasMoreRow = links.length > 1 || moreMenuLinks.length > 0 || isCustomized;

  function renderMenuLink(link: SidebarLink, nested = false): ReactNode {
    return (
      <Fragment key={getSidebarLinkKey(link)}>
        <DropdownMenu.Item
          nativeButton={false}
          inset={nested}
          render={
            <Link
              href={link.url}
              {...(/^(https?:)?\/\//.test(link.url) ? { target: '_blank', rel: 'noreferrer' } : {})}
            />
          }
          aria-current={linkIsActive(link) ? 'page' : undefined}
        >
          {link.icon}
          {link.name}
        </DropdownMenu.Item>
        {link.children?.map(child => renderMenuLink(child, true))}
      </Fragment>
    );
  }

  return (
    <>
      {shownLinks.map(link => (
        <ContextMenu key={getSidebarLinkKey(link)}>
          <ContextMenu.Trigger
            render={<SidebarSectionLink link={link} activeCandidates={activeCandidates} isActive={isActive} />}
          />
          <ContextMenu.Content aria-label={`${link.name} options`}>
            <ContextMenu.RadioGroup
              value={placementOf(link)}
              onValueChange={placement => {
                if (isSidebarLinkPlacement(placement)) onPlacementChange(link, placement);
              }}
            >
              {sidebarLinkPlacements.map(placement => (
                <ContextMenu.RadioItem key={placement} value={placement}>
                  {sidebarLinkPlacementLabels[placement]}
                </ContextMenu.RadioItem>
              ))}
            </ContextMenu.RadioGroup>
            <ContextMenu.Separator />
            <ContextMenu.Item onClick={onCustomize}>Customize sidebar…</ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu>
      ))}
      {hasMoreRow ? (
        <DropdownMenu modal={false}>
          <SidebarNavLink
            link={{ name: 'More', url: '', icon: <MoreHorizontalIcon /> }}
            render={
              <DropdownMenu.Trigger render={<button type="button" />} aria-label="More">
                <MoreHorizontalIcon aria-hidden="true" />
                <SidebarNavLabel>More</SidebarNavLabel>
              </DropdownMenu.Trigger>
            }
          />
          <DropdownMenu.Content align="start" aria-label="More navigation" className="min-w-44">
            {moreMenuLinks.map(link => renderMenuLink(link))}
            {moreMenuLinks.length > 0 && <DropdownMenu.Separator />}
            <DropdownMenu.Item onClick={onCustomize}>
              <Settings2Icon />
              Customize sidebar
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      ) : null}
    </>
  );
}
