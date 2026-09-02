import type { Meta, StoryObj } from '@storybook/react-vite';
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

export const Recommended: Story = {
  render: () => (
    <Tabs defaultTab="tab1" className="w-100">
      <TabList variant="pill">
        <Tab value="tab1">Overview</Tab>
        <Tab value="tab2">Details</Tab>
        <Tab value="tab3">Settings</Tab>
      </TabList>
      <TabContent value="tab1">
        <div className="p-4 text-(--text-primary)">Overview content goes here</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-(--text-primary)">Details content goes here</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-(--text-primary)">Settings content goes here</div>
      </TabContent>
    </Tabs>
  ),
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
        <div className="p-4 text-(--text-primary)">Line fallback content goes here</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-(--text-primary)">Details content goes here</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-(--text-primary)">Settings content goes here</div>
      </TabContent>
    </Tabs>
  ),
};

export const TwoTabs: Story = {
  render: () => (
    <Tabs defaultTab="input" className="w-dropdown-max-height">
      <TabList>
        <Tab value="input">Input</Tab>
        <Tab value="output">Output</Tab>
      </TabList>
      <TabContent value="input">
        <div className="p-4 text-(--text-primary)">Input content</div>
      </TabContent>
      <TabContent value="output">
        <div className="p-4 text-(--text-primary)">Output content</div>
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
        <div className="p-4 text-(--text-primary)">Content 1</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-(--text-primary)">Content 2</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-(--text-primary)">Content 3</div>
      </TabContent>
      <TabContent value="tab4">
        <div className="p-4 text-(--text-primary)">Content 4</div>
      </TabContent>
      <TabContent value="tab5">
        <div className="p-4 text-(--text-primary)">Content 5</div>
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
        <div className="p-4 text-(--text-primary)">Overview content</div>
      </TabContent>
      <TabContent value="projects">
        <div className="p-4 text-(--text-primary)">Projects content</div>
      </TabContent>
      <TabContent value="account">
        <div className="p-4 text-(--text-primary)">Account content</div>
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
        <div className="p-4 text-(--text-primary)">Overview content</div>
      </TabContent>
      <TabContent value="projects">
        <div className="p-4 text-(--text-primary)">Projects content</div>
      </TabContent>
      <TabContent value="account">
        <div className="p-4 text-(--text-primary)">Account content</div>
      </TabContent>
    </Tabs>
  ),
};

export const CustomIndicatorColor: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Tabs defaultTab="tab1" className="w-100">
        <TabList style={{ '--tab-indicator-color': 'var(--purple-9)' } as React.CSSProperties}>
          <Tab value="tab1">Overview</Tab>
          <Tab value="tab2">Details</Tab>
          <Tab value="tab3">Settings</Tab>
        </TabList>
        <TabContent value="tab1">
          <div className="p-4 text-(--text-primary)">Line variant with accent indicator</div>
        </TabContent>
        <TabContent value="tab2">
          <div className="p-4 text-(--text-primary)">Details content</div>
        </TabContent>
        <TabContent value="tab3">
          <div className="p-4 text-(--text-primary)">Settings content</div>
        </TabContent>
      </Tabs>

      <Tabs defaultTab="overview" className="w-100">
        <TabList variant="pill" style={{ '--tab-indicator-color': 'var(--purple-9)' } as React.CSSProperties}>
          <Tab value="overview">Overview</Tab>
          <Tab value="projects">Projects</Tab>
          <Tab value="account">Account</Tab>
        </TabList>
        <TabContent value="overview">
          <div className="p-4 text-(--text-primary)">Pill variant with accent indicator</div>
        </TabContent>
        <TabContent value="projects">
          <div className="p-4 text-(--text-primary)">Projects content</div>
        </TabContent>
        <TabContent value="account">
          <div className="p-4 text-(--text-primary)">Account content</div>
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
        <div className="p-4 text-(--text-primary)">index.ts content</div>
      </TabContent>
      <TabContent value="file2">
        <div className="p-4 text-(--text-primary)">utils.ts content</div>
      </TabContent>
      <TabContent value="file3">
        <div className="p-4 text-(--text-primary)">types.ts content</div>
      </TabContent>
    </Tabs>
  ),
};
