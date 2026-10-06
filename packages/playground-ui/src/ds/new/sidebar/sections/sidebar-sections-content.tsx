import { useId, useState } from 'react';
import { SidebarNavHeader } from '../nav/sidebar-nav-header';
import { SidebarNavList } from '../nav/sidebar-nav-list';
import { SidebarNavSection } from '../nav/sidebar-nav-section';
import { SidebarNavSeparator } from '../nav/sidebar-nav-separator';
import { SidebarCustomizeDialog } from './sidebar-customize-dialog';
import { SidebarMoreLinks } from './sidebar-more-links';
import { SidebarSectionLink } from './sidebar-section-link';
import type { SidebarSectionsProps } from './sidebar-sections';
import {
  getDefaultPlacement,
  getSidebarLinkKey,
  getSidebarVisibilityKey,
  placementsSchema,
} from './sidebar-visibility';
import type { OptionalSidebarLink, SidebarLinkPlacement } from './sidebar-visibility';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';

export function SidebarSectionsContent({
  sections,
  isActive,
  className,
  visibilityStorageKey,
}: SidebarSectionsProps & { visibilityStorageKey: string }) {
  const baseId = useId();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [placements, setPlacements] = useLocalStorageState({
    initialKey: visibilityStorageKey,
    defaultValue: {},
    schema: placementsSchema,
  });

  function placementOf(sectionKey: string, link: OptionalSidebarLink, optionalLinkCount: number) {
    return placements[getSidebarVisibilityKey(sectionKey, link)] ?? getDefaultPlacement(link, optionalLinkCount);
  }

  function changePlacement(sectionKey: string, link: OptionalSidebarLink, placement: SidebarLinkPlacement) {
    setPlacements(current => ({ ...current, [getSidebarVisibilityKey(sectionKey, link)]: placement }));
  }

  return (
    <>
      {sections.map(section => {
        const showSeparator = section.links.length > 0 && section.separator;
        const headerId = section.title ? `${baseId}-${section.key}` : undefined;
        const moreLinks = section.moreLinks ?? [];
        const activeCandidates = [...section.links, ...moreLinks];

        return (
          <SidebarNavSection
            key={section.key}
            className={className}
            aria-labelledby={headerId}
            aria-label={!headerId ? section.key : undefined}
          >
            {showSeparator ? <SidebarNavSeparator className="[&:after]:border-border" /> : null}
            {section.title ? (
              <SidebarNavHeader id={headerId} href={section.href} isActive={section.isHeaderActive}>
                {section.title}
              </SidebarNavHeader>
            ) : null}
            <SidebarNavList>
              {section.links.map(link => (
                <SidebarSectionLink
                  key={getSidebarLinkKey(link)}
                  link={link}
                  activeCandidates={activeCandidates}
                  isActive={isActive}
                />
              ))}
              {moreLinks.length > 0 ? (
                <SidebarMoreLinks
                  links={moreLinks}
                  activeCandidates={activeCandidates}
                  isActive={isActive}
                  placementOf={link => placementOf(section.key, link, moreLinks.length)}
                  onPlacementChange={(link, placement) => changePlacement(section.key, link, placement)}
                  onCustomize={() => setCustomizeOpen(true)}
                />
              ) : null}
            </SidebarNavList>
          </SidebarNavSection>
        );
      })}
      <SidebarCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        sections={sections}
        placementOf={placementOf}
        onPlacementChange={changePlacement}
      />
    </>
  );
}
