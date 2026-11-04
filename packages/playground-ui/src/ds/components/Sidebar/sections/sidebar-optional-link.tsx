import { useRef } from 'react';
import type { SidebarLink } from '../nav/sidebar-nav-link';
import { SidebarSectionLink } from './sidebar-section-link';
import type { OptionalSidebarLink, SidebarLinkPlacement } from './sidebar-visibility';
import { isSidebarLinkPlacement, sidebarLinkPlacementLabels, sidebarLinkPlacements } from './sidebar-visibility';
import { ContextMenu } from '@/ds/components/ContextMenu';

export type SidebarOptionalLinkProps = {
  link: OptionalSidebarLink;
  activeCandidates: SidebarLink[];
  isActive?: (link: SidebarLink, activeCandidates: SidebarLink[]) => boolean;
  placement: SidebarLinkPlacement;
  onPlacementChange: (placement: SidebarLinkPlacement) => void;
  onCustomize: (returnFocusTo: HTMLElement | null) => void;
};

export function SidebarOptionalLink({
  link,
  activeCandidates,
  isActive,
  placement,
  onPlacementChange,
  onCustomize,
}: SidebarOptionalLinkProps) {
  const itemRef = useRef<HTMLElement | null>(null);

  return (
    <ContextMenu>
      <ContextMenu.Trigger
        ref={(node: HTMLElement | null) => {
          itemRef.current = node;
        }}
        render={<SidebarSectionLink link={link} activeCandidates={activeCandidates} isActive={isActive} />}
      />
      <ContextMenu.Content aria-label={`${link.name} options`}>
        <ContextMenu.RadioGroup
          value={placement}
          onValueChange={value => {
            if (isSidebarLinkPlacement(value)) onPlacementChange(value);
          }}
        >
          {sidebarLinkPlacements.map(option => (
            <ContextMenu.RadioItem key={option} value={option}>
              {sidebarLinkPlacementLabels[option]}
            </ContextMenu.RadioItem>
          ))}
        </ContextMenu.RadioGroup>
        <ContextMenu.Separator />
        <ContextMenu.Item onClick={() => onCustomize(itemRef.current?.querySelector('a') ?? null)}>
          Customize sidebar…
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  );
}
