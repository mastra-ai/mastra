import { TabsRoot } from './tabs-root';
import { TabList } from './tabs-list';
import { Tab } from './tabs-tab';
import { TabContent } from './tabs-content';

export const Tabs = Object.assign(TabsRoot, {
  List: TabList,
  Tab,
  Content: TabContent,
});
