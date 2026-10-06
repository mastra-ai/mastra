import { useId } from 'react';
import { SidebarNewMoreLinks } from './sidebar-new-more-links';
import { SidebarNewNavHeader } from './sidebar-new-nav-header';
import { SidebarNewSectionLink } from './sidebar-new-section-link';
import type { SidebarNewSectionsProps } from './sidebar-new-sections';
import { getSidebarLinkKey, visibilitySchema } from './sidebar-new-visibility';
import { MainSidebarNavList } from '@/ds/components/MainSidebar/main-sidebar-nav-list';
import { MainSidebarNavSection } from '@/ds/components/MainSidebar/main-sidebar-nav-section';
import { MainSidebarNavSeparator } from '@/ds/components/MainSidebar/main-sidebar-nav-separator';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';

export function SidebarNewSectionsContent({
  sections,
  isActive,
  className,
  visibilityStorageKey,
}: SidebarNewSectionsProps & { visibilityStorageKey: string }) {
  const baseId = useId();
  const [visibility, setVisibility] = useLocalStorageState({
    initialKey: visibilityStorageKey,
    defaultValue: {},
    schema: visibilitySchema,
  });
  function changeVisibility(visibilityKey: string, visible: boolean) {
    setVisibility(current => ({ ...current, [visibilityKey]: visible }));
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
            {showSeparator ? <MainSidebarNavSeparator className="[&:after]:border-border" /> : null}
            {section.title ? (
              <SidebarNewNavHeader id={headerId} href={section.href} isActive={section.isHeaderActive}>
                {section.title}
              </SidebarNewNavHeader>
            ) : null}
            <MainSidebarNavList>
              {section.links.map(link => (
                <SidebarNewSectionLink
                  key={getSidebarLinkKey(link)}
                  link={link}
                  activeCandidates={activeCandidates}
                  isActive={isActive}
                />
              ))}
              {section.moreLinks?.length ? (
                <SidebarNewMoreLinks
                  sectionKey={section.key}
                  links={section.moreLinks}
                  activeCandidates={activeCandidates}
                  isActive={isActive}
                  visibility={visibility}
                  onVisibilityChange={changeVisibility}
                />
              ) : null}
            </MainSidebarNavList>
          </MainSidebarNavSection>
        );
      })}
    </>
  );
}
