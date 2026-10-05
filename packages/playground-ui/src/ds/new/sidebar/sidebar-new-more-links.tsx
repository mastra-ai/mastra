import { MoreHorizontalIcon, Settings2Icon } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { SidebarNewSectionLink } from './sidebar-new-section-link';
import type { SidebarNewSection } from './sidebar-new-sections';
import { getSidebarLinkKey, getSidebarVisibilityKey } from './sidebar-new-visibility';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { useMaybeSidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import { MainSidebarNavLabel } from '@/ds/components/MainSidebar/main-sidebar-nav-label';
import type { NavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import { MainSidebarNavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';

export type SidebarNewMoreLinksProps = {
  sectionKey: string;
  links: NonNullable<SidebarNewSection['moreLinks']>;
  activeCandidates: NavLink[];
  isActive?: (link: NavLink, activeCandidates: NavLink[]) => boolean;
  visibility: Record<string, boolean>;
  onVisibilityChange: (visibilityKey: string, visible: boolean) => void;
};

export function SidebarNewMoreLinks({
  sectionKey,
  links,
  activeCandidates,
  isActive,
  visibility,
  onVisibilityChange,
}: SidebarNewMoreLinksProps) {
  const context = useMaybeSidebarState();
  const Link = context?.LinkComponent ?? 'a';
  const linkIsActive = (link: NavLink) => isActive?.(link, activeCandidates) ?? link.isActive ?? false;
  const defaultVisibility = (link: (typeof links)[number]) => link.defaultVisible ?? links.length < 2;
  const savedVisibility = (link: (typeof links)[number]) =>
    visibility[getSidebarVisibilityKey(sectionKey, link)] ?? defaultVisibility(link);
  const shownLinks = links.filter(link => linkIsActive(link) || savedVisibility(link));
  const hiddenLinks = links.filter(link => !shownLinks.includes(link));
  const isCustomized = links.some(link => savedVisibility(link) !== defaultVisibility(link));
  const hasMenu = hiddenLinks.length > 0 || isCustomized;

  function renderMenuLink(link: NavLink, nested = false): ReactNode {
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
        <SidebarNewSectionLink
          key={getSidebarLinkKey(link)}
          link={link}
          activeCandidates={activeCandidates}
          isActive={isActive}
        />
      ))}
      {hasMenu ? (
        <DropdownMenu modal={false}>
          <MainSidebarNavLink
            link={{ name: 'More', url: '', icon: <MoreHorizontalIcon /> }}
            render={
              <DropdownMenu.Trigger render={<button type="button" />} aria-label="More">
                <MoreHorizontalIcon aria-hidden="true" />
                <MainSidebarNavLabel>More</MainSidebarNavLabel>
              </DropdownMenu.Trigger>
            }
          />
          <DropdownMenu.Content align="start" aria-label="More navigation">
            {hiddenLinks.map(link => renderMenuLink(link))}
            {hiddenLinks.length > 0 && <DropdownMenu.Separator />}
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>
                <Settings2Icon />
                Customize sidebar
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent aria-label="Customize sidebar">
                {links.map(link => (
                  <DropdownMenu.CheckboxItem
                    key={getSidebarLinkKey(link)}
                    checked={savedVisibility(link)}
                    onCheckedChange={visible => onVisibilityChange(getSidebarVisibilityKey(sectionKey, link), visible)}
                    closeOnClick={false}
                  >
                    {link.icon}
                    {link.name}
                  </DropdownMenu.CheckboxItem>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          </DropdownMenu.Content>
        </DropdownMenu>
      ) : null}
    </>
  );
}
