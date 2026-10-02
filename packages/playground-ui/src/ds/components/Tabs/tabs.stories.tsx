import type { Meta, StoryObj } from '@storybook/react-vite';
import { Activity, ChartNoAxesColumnIncreasing, Settings } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, CSSProperties } from 'react';
import { TabContent } from './tabs-content';
import { TabList } from './tabs-list';
import { Tabs } from './tabs-root';
import { Tab } from './tabs-tab';

const meta: Meta<typeof Tabs> = {
  title: 'Navigation/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

type TabIndicatorStyle = CSSProperties & {
  '--tab-indicator-color': string;
};

const accentIndicatorStyle: TabIndicatorStyle = {
  '--tab-indicator-color': 'var(--info-indicator)',
};

export const Recommended: Story = {
  render: () => (
    <Tabs defaultTab="tab1" className="w-100">
      <TabList variant="pill">
        <Tab value="tab1">Overview</Tab>
        <Tab value="tab2">Details</Tab>
        <Tab value="tab3">Settings</Tab>
      </TabList>
      <TabContent value="tab1">
        <div className="p-4 text-foreground">Overview content goes here</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-foreground">Details content goes here</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-foreground">Settings content goes here</div>
      </TabContent>
    </Tabs>
  ),
};

type ContainedArgs = ComponentProps<typeof Tabs> & { moreTabs: boolean; closableTabs: boolean; attention: boolean };
type ContainedStory = StoryObj<ContainedArgs>;

const extraTabs = ['Deployments', 'Logs', 'Metrics', 'Scorers', 'Datasets', 'Integrations'];

export const Contained: ContainedStory = {
  args: { frame: 'stroke', moreTabs: false, closableTabs: false, attention: false },
  argTypes: {
    moreTabs: { name: 'More tabs', control: 'boolean' },
    closableTabs: { name: 'Closable tabs', control: 'boolean' },
    attention: { name: 'Traces needs attention', control: 'boolean' },
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: ({ frame, moreTabs, closableTabs, attention }) => (
    <ContainedExample
      key={`${moreTabs}-${closableTabs}`}
      attention={attention}
      frame={frame}
      moreTabs={moreTabs}
      closableTabs={closableTabs}
    />
  ),
};

function ContainedExample({
  frame,
  moreTabs,
  closableTabs,
  attention,
}: Pick<ContainedArgs, 'frame' | 'moreTabs' | 'closableTabs' | 'attention'>) {
  const [closedTabs, setClosedTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('activity');
  const visibleTabs = ['activity', 'traces', 'settings', ...(moreTabs ? extraTabs : [])].filter(
    tab => !closedTabs.includes(tab),
  );
  const closeHandler = (tab: string) =>
    closableTabs && visibleTabs.length > 1
      ? () => {
          if (activeTab === tab) {
            const index = visibleTabs.indexOf(tab);
            const nextTab = visibleTabs[index + 1] ?? visibleTabs[index - 1];
            if (nextTab === undefined) return;
            setActiveTab(nextTab);
          }
          setClosedTabs(closed => [...closed, tab]);
        }
      : undefined;
  return (
    <main className="min-h-screen bg-sidebar p-4 sm:p-10">
      <div className="mx-auto w-full max-w-5xl">
        <Tabs defaultTab="activity" value={activeTab} onValueChange={setActiveTab} appearance="contained" frame={frame}>
          <TabList>
            {visibleTabs.includes('activity') && (
              <Tab value="activity" onClose={closeHandler('activity')}>
                <Activity aria-hidden="true" className="size-4" />
                Activity
                <span className="rounded-full bg-surface-overlay-strong px-2 py-0.5 text-meta tabular-nums">12</span>
              </Tab>
            )}
            {visibleTabs.includes('traces') && (
              <Tab value="traces" attention={attention} onClose={closeHandler('traces')}>
                <ChartNoAxesColumnIncreasing aria-hidden="true" className="size-4" />
                Traces
                <span className="rounded-full bg-surface-overlay-strong px-2 py-0.5 text-meta tabular-nums">248</span>
              </Tab>
            )}
            {visibleTabs.includes('settings') && (
              <Tab value="settings" onClose={closeHandler('settings')}>
                <Settings aria-hidden="true" className="size-4" />
                Settings
              </Tab>
            )}
            {moreTabs &&
              extraTabs
                .filter(label => visibleTabs.includes(label))
                .map(label => (
                  <Tab key={label} value={label} onClose={closeHandler(label)}>
                    {label}
                  </Tab>
                ))}
          </TabList>
          <TabContent value="activity">
            <div className="grid gap-6">
              <div className="grid gap-1">
                <h2 className="text-heading text-foreground">Recent activity</h2>
                <p className="text-body text-muted-foreground">Runs and deployments from the last seven days.</p>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
                <div className="flex items-center justify-between gap-4 p-4">
                  <span className="text-body text-foreground">Production deployment</span>
                  <span className="text-caption text-muted-foreground">2 minutes ago</span>
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <span className="text-body text-foreground">Evaluation run completed</span>
                  <span className="text-caption text-muted-foreground">18 minutes ago</span>
                </div>
              </div>
            </div>
          </TabContent>
          <TabContent value="traces">
            <p className="text-body text-muted-foreground">Trace content</p>
          </TabContent>
          <TabContent value="settings">
            <p className="text-body text-muted-foreground">Settings content</p>
          </TabContent>
          {moreTabs &&
            extraTabs
              .filter(label => visibleTabs.includes(label))
              .map(label => (
                <TabContent key={label} value={label}>
                  <p className="text-body text-muted-foreground">{label} content</p>
                </TabContent>
              ))}
        </Tabs>
      </div>
    </main>
  );
}

export const InsetFrame: ContainedStory = {
  ...Contained,
  args: { frame: 'inset', moreTabs: false, closableTabs: false, attention: false },
};

export const LegacyLineFallback: Story = {
  render: () => (
    <Tabs defaultTab="tab1" className="w-100">
      <TabList>
        <Tab value="tab1">Overview</Tab>
        <Tab value="tab2">Details</Tab>
        <Tab value="tab3">Settings</Tab>
      </TabList>
      <TabContent value="tab1">
        <div className="p-4 text-foreground">Line fallback content goes here</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-foreground">Details content goes here</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-foreground">Settings content goes here</div>
      </TabContent>
    </Tabs>
  ),
};

export const TwoTabs: Story = {
  render: () => (
    <Tabs defaultTab="input" className="w-75">
      <TabList>
        <Tab value="input">Input</Tab>
        <Tab value="output">Output</Tab>
      </TabList>
      <TabContent value="input">
        <div className="p-4 text-foreground">Input content</div>
      </TabContent>
      <TabContent value="output">
        <div className="p-4 text-foreground">Output content</div>
      </TabContent>
    </Tabs>
  ),
};

export const ManyTabs: Story = {
  render: () => (
    <Tabs defaultTab="tab1" className="w-125">
      <TabList>
        <Tab value="tab1">Overview</Tab>
        <Tab value="tab2">Usage Metrics</Tab>
        <Tab value="tab3">Connected Tools</Tab>
        <Tab value="tab4">Tracing Options</Tab>
        <Tab value="tab5">Advanced Settings</Tab>
      </TabList>
      <TabContent value="tab1">
        <div className="p-4 text-foreground">Content 1</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-foreground">Content 2</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-foreground">Content 3</div>
      </TabContent>
      <TabContent value="tab4">
        <div className="p-4 text-foreground">Content 4</div>
      </TabContent>
      <TabContent value="tab5">
        <div className="p-4 text-foreground">Content 5</div>
      </TabContent>
    </Tabs>
  ),
};

export const PillVariant: Story = {
  render: () => (
    <Tabs defaultTab="overview" className="w-125">
      <TabList variant="pill">
        <Tab value="overview">Overview</Tab>
        <Tab value="projects">Projects</Tab>
        <Tab value="account">Account</Tab>
      </TabList>
      <TabContent value="overview">
        <div className="p-4 text-foreground">Overview content</div>
      </TabContent>
      <TabContent value="projects">
        <div className="p-4 text-foreground">Projects content</div>
      </TabContent>
      <TabContent value="account">
        <div className="p-4 text-foreground">Account content</div>
      </TabContent>
    </Tabs>
  ),
};

export const PillGhostVariant: Story = {
  render: () => (
    <Tabs defaultTab="overview" className="w-125">
      <TabList variant="pill-ghost">
        <Tab value="overview">Overview</Tab>
        <Tab value="projects">Projects</Tab>
        <Tab value="account">Account</Tab>
      </TabList>
      <TabContent value="overview">
        <div className="p-4 text-foreground">Overview content</div>
      </TabContent>
      <TabContent value="projects">
        <div className="p-4 text-foreground">Projects content</div>
      </TabContent>
      <TabContent value="account">
        <div className="p-4 text-foreground">Account content</div>
      </TabContent>
    </Tabs>
  ),
};

export const CustomIndicatorColor: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Tabs defaultTab="tab1" className="w-100">
        <TabList style={accentIndicatorStyle}>
          <Tab value="tab1">Overview</Tab>
          <Tab value="tab2">Details</Tab>
          <Tab value="tab3">Settings</Tab>
        </TabList>
        <TabContent value="tab1">
          <div className="p-4 text-foreground">Line variant with accent indicator</div>
        </TabContent>
        <TabContent value="tab2">
          <div className="p-4 text-foreground">Details content</div>
        </TabContent>
        <TabContent value="tab3">
          <div className="p-4 text-foreground">Settings content</div>
        </TabContent>
      </Tabs>

      <Tabs defaultTab="overview" className="w-100">
        <TabList variant="pill" style={accentIndicatorStyle}>
          <Tab value="overview">Overview</Tab>
          <Tab value="projects">Projects</Tab>
          <Tab value="account">Account</Tab>
        </TabList>
        <TabContent value="overview">
          <div className="p-4 text-foreground">Pill variant with accent indicator</div>
        </TabContent>
        <TabContent value="projects">
          <div className="p-4 text-foreground">Projects content</div>
        </TabContent>
        <TabContent value="account">
          <div className="p-4 text-foreground">Account content</div>
        </TabContent>
      </Tabs>
    </div>
  ),
};

export const WithClosableTabs: Story = {
  render: () => (
    <Tabs defaultTab="file1" className="w-100">
      <TabList>
        <Tab value="file1" onClose={() => console.log('Close file1')}>
          index.ts
        </Tab>
        <Tab value="file2" onClose={() => console.log('Close file2')}>
          utils.ts
        </Tab>
        <Tab value="file3" onClose={() => console.log('Close file3')}>
          types.ts
        </Tab>
      </TabList>
      <TabContent value="file1">
        <div className="p-4 text-foreground">index.ts content</div>
      </TabContent>
      <TabContent value="file2">
        <div className="p-4 text-foreground">utils.ts content</div>
      </TabContent>
      <TabContent value="file3">
        <div className="p-4 text-foreground">types.ts content</div>
      </TabContent>
    </Tabs>
  ),
};
