import { PageLayout } from '@mastra/playground-ui/components/PageLayout';

import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { PageLoader } from './PageSuspense';

/** Loader for pages inside `AppLayout`: keeps the header's sidebar trigger reachable while the page code loads. */
export function AppPageLoader() {
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout variant="fit" {...slots}>
      <PageLoader />
    </PageLayout>
  );
}
