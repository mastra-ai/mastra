import { Tab, TabList, Tabs } from '@/ds/components/Tabs';

export type CardViewTabsProps<V extends string> = {
  value: V;
  onValueChange: (value: V) => void;
  /** The views, with their short names (`shortViewLabels` in `lib/view-labels`). */
  options: readonly { value: V; label: string }[];
};

/**
 * A card's views as pill tabs under its title, each one click away; what doesn't fit folds into a
 * "+N" menu. Picking one swaps at once.
 */
export function CardViewTabs<V extends string>({ value, onValueChange, options }: CardViewTabsProps<V>) {
  return (
    <Tabs<V> value={value} defaultTab={value} onValueChange={onValueChange} className="overflow-visible">
      {/* No slide: the pill jumps to the picked view, as the table under it swaps at once. */}
      <TabList variant="pill" size="sm" overflow="menu" className="[&_[data-slot=tabs-indicator]]:transition-none">
        {options.map(option => (
          <Tab key={option.value} value={option.value}>
            {option.label}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
}
