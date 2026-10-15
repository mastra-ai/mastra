import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { useSearchParams } from 'react-router';

import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { ActivityTimeline } from '../domains/factory/components/activity/ActivityTimeline';
import { CodebaseActivity } from '../domains/factory/components/activity/codebase/CodebaseActivity';
import { NeedsYou } from '../domains/factory/components/activity/NeedsYou';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

const ACTIVITY_VIEWS = [
  { value: 'factory', label: 'Factory' },
  { value: 'codebase', label: 'Codebase' },
] as const;

type ActivityView = (typeof ACTIVITY_VIEWS)[number]['value'];

function activityView(value: string | null): ActivityView {
  return ACTIVITY_VIEWS.find(view => view.value === value)?.value ?? 'factory';
}

export function ActivityPage() {
  const factory = useActiveFactory();
  const slots = useSidebarHeaderSlots();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = activityView(searchParams.get('view'));

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
              value={view}
              onValueChange={next =>
                setSearchParams(current => {
                  if (next === 'factory') current.delete('view');
                  else current.set('view', next);
                  return current;
                })
              }
            >
              {ACTIVITY_VIEWS.map(option => (
                <SegmentedControlItem key={option.value} value={option.value}>
                  {option.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </PageHeader.Action>
        </PageHeader>
      }
    >
      <div className="flex flex-col gap-10 pt-6 pb-16">
        {view === 'factory' ? (
          <>
            <NeedsYou factoryId={factory.id} />
            <ActivityTimeline factoryId={factory.id} />
          </>
        ) : (
          <CodebaseActivity factoryId={factory.id} repositories={factory.repositories} />
        )}
      </div>
    </PageLayout>
  );
}
