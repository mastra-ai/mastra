import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs } from './tabs-root';
import { TabList } from './tabs-list';
import { Tab } from './tabs-tab';
import { TabContent } from './tabs-content';

const meta: Meta<typeof Tabs> = {
  title: 'Navigation/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
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
        <div className="text-neutral2 text-ui-md">Overview content goes here</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="text-neutral2 text-ui-md">Details content goes here</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="text-neutral2 text-ui-md">Settings content goes here</div>
      </TabContent>
    </Tabs>
  ),
};

export const ListAlignments: Story = {
  render: () => (
    <div className="flex flex-col gap-8 w-[500px]">
      <Tabs defaultTab="tab1">
        <TabList>
          <Tab value="tab1">Overview</Tab>
          <Tab value="tab2">Details</Tab>
          <Tab value="tab3">Settings</Tab>
        </TabList>
        <TabContent value="tab1">
          <div className="text-neutral2 text-ui-md">Tabs are left-aligned</div>
        </TabContent>
      </Tabs>
      <Tabs defaultTab="tab1">
        <TabList alignment="full-width">
          <Tab value="tab1">Overview</Tab>
          <Tab value="tab2">Details</Tab>
          <Tab value="tab3">Settings</Tab>
        </TabList>
        <TabContent value="tab1">
          <div className="text-neutral2 text-ui-md">Tabs stretch to fill the width</div>
        </TabContent>
      </Tabs>
    </div>
  ),
};

export const TabSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8 w-[500px]">
      <Tabs defaultTab="tab1">
        <TabList>
          <Tab value="tab1">Overview</Tab>
          <Tab value="tab2">Details</Tab>
          <Tab value="tab3">Settings</Tab>
        </TabList>
        <TabContent value="tab1">
          <div className="text-neutral2 text-ui-md">Default size tabs</div>
        </TabContent>
      </Tabs>
      <Tabs defaultTab="tab1">
        <TabList>
          <Tab value="tab1" size="smaller">
            Overview
          </Tab>
          <Tab value="tab2" size="smaller">
            Details
          </Tab>
          <Tab value="tab3" size="smaller">
            Settings
          </Tab>
        </TabList>
        <TabContent value="tab1">
          <div className="text-neutral2 text-ui-md">Small size tabs</div>
        </TabContent>
      </Tabs>
    </div>
  ),
};

export const ManyTabs: Story = {
  render: () => (
    <Tabs defaultTab="tab1" className="w-[500px]">
      <TabList>
        <Tab value="tab1">Tab 1</Tab>
        <Tab value="tab2">Tab 2</Tab>
        <Tab value="tab3">Tab 3</Tab>
        <Tab value="tab4">Tab 4</Tab>
        <Tab value="tab5">Tab 5</Tab>
      </TabList>
      <TabContent value="tab1">
        <div className="text-neutral2 text-ui-md">Content 1</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="text-neutral2 text-ui-md">Content 2</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="text-neutral2 text-ui-md">Content 3</div>
      </TabContent>
      <TabContent value="tab4">
        <div className="text-neutral2 text-ui-md">Content 4</div>
      </TabContent>
      <TabContent value="tab5">
        <div className="text-neutral2 text-ui-md">Content 5</div>
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
        <div className="text-neutral2 text-ui-md">index.ts content</div>
      </TabContent>
      <TabContent value="file2">
        <div className="text-neutral2 text-ui-md">utils.ts content</div>
      </TabContent>
      <TabContent value="file3">
        <div className="text-neutral2 text-ui-md">types.ts content</div>
      </TabContent>
    </Tabs>
  ),
};
