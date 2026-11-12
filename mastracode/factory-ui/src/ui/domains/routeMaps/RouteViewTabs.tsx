import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';

type RouteView = 'editor' | 'map';

/** Which view of a route list the page shows, kept in the URL so a map can be linked and Back returns to it. */
export function useRouteView(): [RouteView, (view: RouteView) => void] {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'map' ? 'map' : 'editor';
  const setView = (next: RouteView) =>
    setParams(current => {
      const updated = new URLSearchParams(current);
      if (next === 'map') updated.set('view', 'map');
      else updated.delete('view');
      return updated;
    });
  return [view, setView];
}

/** A route list's editor and its read-only map, one at a time. */
export function RouteViewTabs({ label, editor, map }: { label: string; editor: ReactNode; map: ReactNode }) {
  const [view, setView] = useRouteView();
  return (
    <Tabs defaultTab="editor" value={view} onValueChange={setView} aria-label={label} className="overflow-visible">
      <TabList>
        <Tab value="editor">Edit</Tab>
        <Tab value="map">Map</Tab>
      </TabList>
      <TabContent value="editor" flush className="overflow-visible pt-5">
        {editor}
      </TabContent>
      <TabContent value="map" flush className="overflow-visible pt-5">
        {map}
      </TabContent>
    </Tabs>
  );
}
