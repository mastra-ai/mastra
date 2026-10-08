import { Button } from '@mastra/playground-ui/components/Button';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { FeatureShell } from './feature-shell';
import { ContextualSidebarHeader } from './ui/contextual-sidebar-header';
import { ContextualSidebarLayout } from './ui/contextual-sidebar-layout';
import { SidebarSlot } from './ui/sidebar-slot';
import { SidebarSlotProvider } from './ui/sidebar-slot-provider';
import { Link } from '@/lib/link';

/** The route supplies a single full-height control surface for its detail view. */
export function ResourceDetailShell({
  navigationId,
  label,
  back,
  children,
}: {
  navigationId: string;
  label: string;
  back: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <SidebarSlotProvider>
      <FeatureShell
        navigationId={navigationId}
        label={label}
        sidebar={
          <ContextualSidebarLayout
            label={label}
            header={
              <ContextualSidebarHeader>
                <Button variant="ghost" size="sm" icon={<ChevronLeft />} render={<Link href={back.href} />}>
                  {back.label}
                </Button>
              </ContextualSidebarHeader>
            }
          >
            <SidebarSlot />
          </ContextualSidebarLayout>
        }
      >
        {children}
      </FeatureShell>
    </SidebarSlotProvider>
  );
}
