import { useLayoutEffect, useRef } from 'react';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';

/** One of a card's views, as a tab. */
export type ChartCardTabOption<V extends string = string> = { value: V; label: string };

export type ChartCardTabsProps<V extends string = string> = {
  /** The open view. */
  value: V;
  onValueChange: (value: V) => void;
  /** The views (e.g. "Agent latency", "Tool latency"), each a tab, in order. */
  options: readonly ChartCardTabOption<V>[];
};

/**
 * A card's views as ghost pill tabs under its title, each one click away, like the Studio's other view
 * switches. In a row too narrow for every tab (a card's toolbar on a phone), the list shrinks to the
 * room it has and scrolls sideways. Tabs are keyed by position, so two cards listing the same views
 * render the same tabs whatever their values.
 */
export function ChartCardTabs<V extends string>({ value, onValueChange, options }: ChartCardTabsProps<V>) {
  const open = String(
    Math.max(
      0,
      options.findIndex(o => o.value === value),
    ),
  );
  const root = useRef<HTMLDivElement>(null);
  // Keeps the open tab in the row on a narrow card: a click focuses, and so shows, its tab, but a card
  // can open on a later tab, or move to one itself (an org page's Breakdown opens on Agents once its
  // projects answer). Only the row scrolls, never the page.
  useLayoutEffect(() => {
    const row = root.current?.querySelector<HTMLElement>('[data-slot="tabs-list-scroll"]');
    const tab = root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!row || !tab) return;
    const shown = row.getBoundingClientRect();
    const box = tab.getBoundingClientRect();
    // Tabs sit at fractional offsets; rounding the scroll outwards keeps the whole tab in the row.
    if (box.left < shown.left) row.scrollLeft -= Math.ceil(shown.left - box.left);
    else if (box.right > shown.right) row.scrollLeft += Math.ceil(box.right - shown.right);
  }, [open]);
  return (
    <Tabs
      ref={root}
      value={open}
      defaultTab={open}
      onValueChange={index => {
        const picked = options[Number(index)];
        if (picked) onValueChange(picked.value);
      }}
      className="min-w-0"
    >
      <TabList variant="pill-ghost" size="sm">
        {options.map((option, i) => (
          <Tab key={i} value={String(i)}>
            {option.label}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
}
