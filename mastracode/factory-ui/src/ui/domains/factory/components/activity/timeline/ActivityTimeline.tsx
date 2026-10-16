import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { useState } from 'react';

import { PropertiesMenu } from '../../../../../ui/PropertiesMenu';
import type { ActivityGrouping } from '../../../activity';
import type { AuditNamespace } from '../../../auditPresentation';
import { FactoryFeed } from '../feed/FactoryFeed';
import { AuditPortalItem } from './AuditPortalItem';
import { CategoryFilter } from './CategoryFilter';
import { setCompactTimeline, useCompactTimeline } from './compactTimeline';
import { useTimelineGrouping } from './useTimelineGrouping';

const GROUPING_OPTIONS = [
  { value: 'similar', label: 'Similar' },
  { value: 'none', label: 'None' },
] satisfies Array<{ value: ActivityGrouping; label: string }>;

export function ActivityTimeline({ factoryId }: { factoryId: string }) {
  const [grouping, setGrouping] = useTimelineGrouping();
  const compact = useCompactTimeline();
  const [categories, setCategories] = useState<ReadonlySet<AuditNamespace>>(() => new Set());
  const changedCount = [grouping !== 'similar', compact, categories.size > 0].filter(Boolean).length;

  const reset = () => {
    setGrouping('similar');
    setCompactTimeline(false);
    setCategories(new Set());
  };

  return (
    <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
      <div className="min-h-control-sm flex items-center gap-2">
        <Txt as="h2" variant="column" tone="ink" id="timeline-heading" className="m-0">
          Timeline
        </Txt>
        <span className="ml-auto">
          <PropertiesMenu label="Timeline properties" align="end" changedCount={changedCount} onReset={reset}>
            <DropdownMenu.RadioSub
              label="Group"
              icon={<LayoutGrid aria-hidden />}
              options={GROUPING_OPTIONS}
              value={grouping}
              onValueChange={setGrouping}
            />
            <CategoryFilter categories={categories} onChange={setCategories} />
            <DropdownMenu.CheckboxItem checked={compact} onCheckedChange={setCompactTimeline}>
              <Rows3 aria-hidden />
              <span>Compact view</span>
            </DropdownMenu.CheckboxItem>
            <AuditPortalItem />
          </PropertiesMenu>
        </span>
      </div>
      <FactoryFeed
        factoryId={factoryId}
        grouping={grouping}
        compact={compact}
        categories={categories}
        onClearCategories={() => setCategories(new Set())}
      />
    </section>
  );
}
