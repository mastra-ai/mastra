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

export const Default: Story = {
  render: () => (
    <Tabs defaultTab="tab1" className="w-[400px]">
      <TabList>
        <Tab value="tab1">Overview</Tab>
        <Tab value="tab2">Details</Tab>
        <Tab value="tab3">Settings</Tab>
      </TabList>
      <TabContent value="tab1">
        <div className="p-4 text-neutral5">Overview content goes here</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-neutral5">Details content goes here</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-neutral5">Settings content goes here</div>
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
        <div className="p-4 text-neutral5">Input content</div>
      </TabContent>
      <TabContent value="output">
        <div className="p-4 text-neutral5">Output content</div>
      </TabContent>
    </Tabs>
  ),
};

export const ManyTabs: Story = {
  render: () => (
    <Tabs defaultTab="tab1" className="w-[500px]">
      <TabList>
        <Tab value="tab1">Overview</Tab>
        <Tab value="tab2">Usage Metrics</Tab>
        <Tab value="tab3">Connected Tools</Tab>
        <Tab value="tab4">Tracing Options</Tab>
        <Tab value="tab5">Advanced Settings</Tab>
      </TabList>
      <TabContent value="tab1">
        <div className="p-4 text-neutral5">Content 1</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-neutral5">Content 2</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-neutral5">Content 3</div>
      </TabContent>
      <TabContent value="tab4">
        <div className="p-4 text-neutral5">Content 4</div>
      </TabContent>
      <TabContent value="tab5">
        <div className="p-4 text-neutral5">Content 5</div>
      </TabContent>
    </Tabs>
  ),
};

export const WithClosableTabs: Story = {
  render: () => (
    <Tabs defaultTab="file1" className="w-[400px]">
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
        <div className="p-4 text-neutral5">index.ts content</div>
      </TabContent>
      <TabContent value="file2">
        <div className="p-4 text-neutral5">utils.ts content</div>
      </TabContent>
      <TabContent value="file3">
        <div className="p-4 text-neutral5">types.ts content</div>
      </TabContent>
    </Tabs>
  ),
};
