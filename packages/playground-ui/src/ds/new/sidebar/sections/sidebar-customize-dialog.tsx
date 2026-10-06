import { useId } from 'react';
import type { SidebarSection } from './sidebar-sections';
import {
  getSidebarLinkKey,
  isSidebarLinkPlacement,
  sidebarLinkPlacementLabels,
  sidebarLinkPlacements,
} from './sidebar-visibility';
import type { OptionalSidebarLink, SidebarLinkPlacement } from './sidebar-visibility';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';

export type SidebarCustomizeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: SidebarSection[];
  placementOf: (sectionKey: string, link: OptionalSidebarLink, optionalLinkCount: number) => SidebarLinkPlacement;
  onPlacementChange: (sectionKey: string, link: OptionalSidebarLink, placement: SidebarLinkPlacement) => void;
};

export function SidebarCustomizeDialog({
  open,
  onOpenChange,
  sections,
  placementOf,
  onPlacementChange,
}: SidebarCustomizeDialogProps) {
  const baseId = useId();
  const customizableSections = sections.filter(section => (section.moreLinks?.length ?? 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Customize sidebar</DialogTitle>
          <DialogDescription>
            Choose where each optional link appears. Changes save automatically in this browser.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {customizableSections.map(section => {
            const links = section.moreLinks ?? [];
            const headingId = section.title ? `${baseId}-${section.key}` : undefined;

            return (
              <section
                key={section.key}
                aria-labelledby={headingId}
                aria-label={headingId ? undefined : section.key}
                className="space-y-2"
              >
                {section.title ? (
                  <Txt as="h3" id={headingId} variant="label" tone="muted">
                    {section.title}
                  </Txt>
                ) : null}
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {links.map(link => (
                    <li key={getSidebarLinkKey(link)} className="flex min-h-11 items-center gap-2.5 py-1.5 pr-1.5 pl-3">
                      <span aria-hidden="true" className="flex shrink-0 text-muted-foreground [&_svg]:size-4">
                        {link.icon}
                      </span>
                      <Txt as="span" variant="body-sm" className="min-w-0 flex-1 truncate">
                        {link.name}
                      </Txt>
                      <Select
                        value={placementOf(section.key, link, links.length)}
                        onValueChange={placement => {
                          if (isSidebarLinkPlacement(placement)) onPlacementChange(section.key, link, placement);
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          variant="ghost"
                          className="w-44 shrink-0"
                          aria-label={`${link.name} placement`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sidebarLinkPlacements.map(placement => (
                            <SelectItem key={placement} value={placement}>
                              {sidebarLinkPlacementLabels[placement]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
