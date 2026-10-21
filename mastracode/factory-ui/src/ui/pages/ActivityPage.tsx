import { PageLayout } from '@mastra/playground-ui/components/PageLayout';

import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { NeedsYou } from '../domains/factory/components/activity/needs-you/NeedsYou';
import { SpotlightProvider } from '../domains/factory/components/activity/spotlight';
import { Pulse } from '../domains/factory/components/activity/pulse/Pulse';
import { ActivityTimeline } from '../domains/factory/components/activity/timeline/ActivityTimeline';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

export function ActivityPage() {
  const slots = useSidebarHeaderSlots();
  const factory = useActiveFactory();

  return (
    <PageLayout {...slots} variant="narrow">
      <SpotlightProvider>
        <div className="flex flex-col gap-10 pt-6 pb-16">
          <Pulse factoryId={factory.id} repositories={factory.repositories} />
          <NeedsYou factoryId={factory.id} />
          <ActivityTimeline factoryId={factory.id} />
        </div>
      </SpotlightProvider>
    </PageLayout>
  );
}
