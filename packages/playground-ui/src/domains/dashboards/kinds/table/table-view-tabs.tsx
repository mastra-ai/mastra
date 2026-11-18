import { viewLabel } from '../../lib/chrome';
import type { TableOptions } from '../../lib/table';
import { shortViewLabels } from '../../lib/view-labels';
import type { WidgetKindProps } from '../../widget-kind';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';

type TableViewTabsProps = {
  views: WidgetKindProps<TableOptions>['views'];
  /** The open view. */
  index: number;
  onChoose: (index: number) => void;
};

/**
 * A table's views as pill tabs under its title, each one click away; what doesn't fit folds into a
 * "+N" menu. Picking one swaps at once: the pill doesn't slide, as the table under it doesn't fade.
 */
export function TableViewTabs({ views, index, onChoose }: TableViewTabsProps) {
  const labels = shortViewLabels(views.map((view, i) => viewLabel(view.label, i)));
  return (
    <Tabs
      value={String(index)}
      defaultTab={String(index)}
      onValueChange={value => onChoose(Number(value))}
      className="overflow-visible"
    >
      <TabList variant="pill" size="sm" overflow="menu" className="[&_[data-slot=tabs-indicator]]:transition-none">
        {labels.map((label, i) => (
          <Tab key={i} value={String(i)}>
            {label}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
}
