import { PageLayout } from '@mastra/playground-ui/components/PageLayout';

import { AppSidebarSkeleton } from '../AppSidebarSkeleton';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { AppLayoutFrame, AppShellFrame } from './AppLayout';
import { PageLoader } from './PageSuspense';

export function AppLayoutSkeleton({ label }: { label?: string }) {
  return (
    <AppLayoutFrame>
      <AppShellFrame sidebar={<AppSidebarSkeleton />}>
        <PlaceholderPageLoader label={label} />
      </AppShellFrame>
    </AppLayoutFrame>
  );
}

function PlaceholderPageLoader({ label }: { label?: string }) {
  const { breadcrumbs } = useSidebarHeaderSlots();
  return (
    <PageLayout
      variant="fit"
      breadcrumbs={
        breadcrumbs && (
          <div aria-hidden inert className="contents">
            {breadcrumbs}
          </div>
        )
      }
    >
      <PageLoader label={label} />
    </PageLayout>
  );
}
