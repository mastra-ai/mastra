import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { useSearchParams } from 'react-router';

import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { CodebaseActivity } from '../domains/factory/components/activity/codebase/CodebaseActivity';
import { NeedsYou } from '../domains/factory/components/activity/needs-you/NeedsYou';
import { ActivityTimeline } from '../domains/factory/components/activity/timeline/ActivityTimeline';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

const VIEW_PARAM = 'view';
const CODEBASE_VIEW = 'codebase';

function ActivityBody({ codebase }: { codebase: boolean }) {
  const factory = useActiveFactory();

  if (codebase) return <CodebaseActivity factoryId={factory.id} repositories={factory.repositories} />;

  return (
    <>
      <NeedsYou factoryId={factory.id} />
      <ActivityTimeline factoryId={factory.id} />
    </>
  );
}

export function ActivityPage() {
  const slots = useSidebarHeaderSlots();
  const [searchParams, setSearchParams] = useSearchParams();
  const codebase = searchParams.get(VIEW_PARAM) === CODEBASE_VIEW;

  const showCodebase = (next: boolean) => {
    setSearchParams(current => {
      if (next) current.set(VIEW_PARAM, CODEBASE_VIEW);
      else current.delete(VIEW_PARAM);
      return current;
    });
  };

  return (
    <PageLayout
      {...slots}
      variant="narrow"
      header={
        <PageHeader>
          <PageHeader.Title>Activity</PageHeader.Title>
          <PageHeader.Action>
            <SegmentedControl
              aria-label="Activity view"
              size="sm"
              value={codebase ? CODEBASE_VIEW : 'factory'}
              onValueChange={next => showCodebase(next === CODEBASE_VIEW)}
            >
              <SegmentedControlItem value="factory">Factory</SegmentedControlItem>
              <SegmentedControlItem value={CODEBASE_VIEW}>Codebase</SegmentedControlItem>
            </SegmentedControl>
          </PageHeader.Action>
        </PageHeader>
      }
    >
      <div className="flex flex-col gap-10 pt-6 pb-16">
        <ActivityBody codebase={codebase} />
      </div>
    </PageLayout>
  );
}
