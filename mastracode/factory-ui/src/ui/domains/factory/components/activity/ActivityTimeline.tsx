import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ExternalLink, LayoutGrid, ListFilter, Rows3 } from 'lucide-react';

import { useAuditPortalLink } from '../../../../../hooks/useAuditEvents';
import { PropertiesMenu } from '../../../../ui/PropertiesMenu';
import { AUDIT_CATEGORIES } from '../../auditPresentation';
import type { AuditNamespace } from '../../auditPresentation';
import { FactoryFeed } from './FactoryFeed';
import type { ActivityGrouping } from './useTimelineView';
import { useTimelineView } from './useTimelineView';

const GROUPING_OPTIONS = [
  { value: 'similar', label: 'Similar' },
  { value: 'none', label: 'None' },
] satisfies Array<{ value: ActivityGrouping; label: string }>;

function filterHint(categories: ReadonlySet<AuditNamespace>): string {
  if (categories.size === 0) return 'All';
  const [only] = AUDIT_CATEGORIES.filter(category => categories.has(category.namespace));
  return categories.size === 1 && only ? only.label : `${categories.size} kinds`;
}

function CategoryFilter({
  categories,
  onToggle,
  onClear,
}: {
  categories: ReadonlySet<AuditNamespace>;
  onToggle: (category: AuditNamespace) => void;
  onClear: () => void;
}) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger hint={filterHint(categories)}>
        <ListFilter aria-hidden />
        <span>Filter</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        <DropdownMenu.CheckboxItem checked={categories.size === 0} onCheckedChange={onClear}>
          All events
        </DropdownMenu.CheckboxItem>
        <DropdownMenu.Separator />
        {AUDIT_CATEGORIES.map(category => (
          <DropdownMenu.CheckboxItem
            key={category.namespace}
            checked={categories.has(category.namespace)}
            onCheckedChange={() => onToggle(category.namespace)}
          >
            <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${category.dotClass}`} />
            {category.label}
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}

function AuditPortalItem() {
  const portalQuery = useAuditPortalLink(true);
  const portalUrl = portalQuery.data;
  if (!portalUrl) return null;

  return (
    <DropdownMenu.Item
      onClick={() => {
        window.open(portalUrl, '_blank', 'noopener,noreferrer');
        void portalQuery.refetch();
      }}
    >
      <ExternalLink aria-hidden />
      <span>Open audit log in WorkOS</span>
    </DropdownMenu.Item>
  );
}

export function ActivityTimeline({ factoryId }: { factoryId: string }) {
  const view = useTimelineView();

  return (
    <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
      <div className="min-h-control-sm flex items-center gap-2">
        <Txt as="h2" variant="column" tone="ink" id="timeline-heading" className="m-0">
          Timeline
        </Txt>
        <span className="ml-auto">
          <PropertiesMenu label="Timeline properties" align="end" changedCount={view.changedCount} onReset={view.reset}>
            <DropdownMenu.RadioSub
              label="Group"
              icon={<LayoutGrid aria-hidden />}
              options={GROUPING_OPTIONS}
              value={view.grouping}
              onValueChange={view.setGrouping}
            />
            <CategoryFilter
              categories={view.categories}
              onToggle={view.toggleCategory}
              onClear={view.clearCategories}
            />
            <DropdownMenu.CheckboxItem checked={view.compact} onCheckedChange={view.setCompact}>
              <Rows3 aria-hidden />
              <span>Compact view</span>
            </DropdownMenu.CheckboxItem>
            <AuditPortalItem />
          </PropertiesMenu>
        </span>
      </div>
      <FactoryFeed
        factoryId={factoryId}
        grouping={view.grouping}
        compact={view.compact}
        categories={view.categories}
        onClearCategories={view.clearCategories}
      />
    </section>
  );
}
