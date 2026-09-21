import { useId, useState } from 'react';
import { z } from 'zod/v4';
import { SidebarNewMoreLinks } from './sidebar-new-more-links';
import { SidebarNewNavHeader } from './sidebar-new-nav-header';
import { SidebarNewSectionLink } from './sidebar-new-section-link';
import type { NavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import { MainSidebarNavList } from '@/ds/components/MainSidebar/main-sidebar-nav-list';
import type { NavSection } from '@/ds/components/MainSidebar/main-sidebar-nav-section';
import { MainSidebarNavSection } from '@/ds/components/MainSidebar/main-sidebar-nav-section';
import { MainSidebarNavSeparator } from '@/ds/components/MainSidebar/main-sidebar-nav-separator';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';

const recentLinkRetentionMs = 7 * 24 * 60 * 60 * 1000;
const recentLinksSchema = z.record(z.string(), z.number());
const defaultRecentItemsStorageKey = 'mastra:sidebar-new:recent-more-items';

export type SidebarNewSection = NavSection & {
  moreLinks?: NavLink[];
};

export type SidebarNewSectionsProps = {
  sections: SidebarNewSection[];
  isActive?: (link: NavLink, activeCandidates: NavLink[]) => boolean;
  className?: string;
  recentItemsStorageKey?: string;
};

function getLinkKey(link: NavLink) {
  return `${link.url}:${link.name}`;
}

export function SidebarNewSections({
  sections,
  isActive,
  className,
  recentItemsStorageKey = defaultRecentItemsStorageKey,
}: SidebarNewSectionsProps) {
  const baseId = useId();
  const [renderedAt] = useState(Date.now);
  const [recentLinks, setRecentLinks] = useLocalStorageState({
    initialKey: recentItemsStorageKey,
    defaultValue: {},
    schema: recentLinksSchema,
  });
  const recentCutoff = renderedAt - recentLinkRetentionMs;

  function rememberLink(link: NavLink) {
    setRecentLinks(current => ({ ...current, [getLinkKey(link)]: Date.now() }));
  }

  return (
    <>
      {sections.map(section => {
        const showSeparator = section.links.length > 0 && section.separator;
        const headerId = section.title ? `${baseId}-${section.key}` : undefined;
        const activeCandidates = [...section.links, ...(section.moreLinks ?? [])];

        return (
          <MainSidebarNavSection
            key={section.key}
            className={className}
            aria-labelledby={headerId}
            aria-label={!headerId ? section.key : undefined}
          >
            {showSeparator ? <MainSidebarNavSeparator className="[&:after]:border-sidebar-divider" /> : null}
            {section.title ? (
              <SidebarNewNavHeader id={headerId} href={section.href} isActive={section.isHeaderActive}>
                {section.title}
              </SidebarNewNavHeader>
            ) : null}
            <MainSidebarNavList>
              {section.links.map(link => (
                <SidebarNewSectionLink
                  key={getLinkKey(link)}
                  link={link}
                  activeCandidates={activeCandidates}
                  isActive={isActive}
                />
              ))}
              {section.moreLinks?.length ? (
                <SidebarNewMoreLinks
                  links={section.moreLinks}
                  activeCandidates={activeCandidates}
                  isActive={isActive}
                  recentLinks={recentLinks}
                  recentCutoff={recentCutoff}
                  onSelect={rememberLink}
                />
              ) : null}
            </MainSidebarNavList>
          </MainSidebarNavSection>
        );
      })}
    </>
  );
}
