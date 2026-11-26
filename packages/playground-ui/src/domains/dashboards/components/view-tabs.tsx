import { shortViewLabels } from '../lib/view-labels';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';

type ViewTabsProps = {
  /** Every view's full name, in order; the tabs show them without their shared words. */
  labels: readonly string[];
  /** The open view. */
  index: number;
  onChoose: (index: number) => void;
};

/**
 * A widget's views as pill tabs under its title, each one click away; what doesn't fit folds into a
 * "+N" menu. Picking one swaps at once: the pill doesn't slide, as the body under it doesn't fade.
 */
export function ViewTabs({ labels, index, onChoose }: ViewTabsProps) {
  return (
    <Tabs
      value={String(index)}
      defaultTab={String(index)}
      onValueChange={value => onChoose(Number(value))}
      // Grows into the toolbar's free space, so folding measures the room beside a legend; no taller
      // than its tabs, so a card stacking them in a column leaves its spare height under the body.
      className="max-h-fit min-w-0 grow overflow-visible"
    >
      <TabList variant="pill" size="sm" overflow="menu" className="[&_[data-slot=tabs-indicator]]:transition-none">
        {shortViewLabels(labels).map((label, i) => (
          <Tab key={i} value={String(i)}>
            {label}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
}
