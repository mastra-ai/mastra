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
        <div className="p-4 text-icon5">Overview content goes here</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-icon5">Details content goes here</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-icon5">Settings content goes here</div>
      </TabContent>
    </Tabs>
  ),
};

export const ButtonsVariant: Story = {
  render: () => (
    <Tabs defaultTab="code" className="w-[400px]">
      <TabList variant="buttons">
        <Tab value="code">Code</Tab>
        <Tab value="preview">Preview</Tab>
        <Tab value="output">Output</Tab>
      </TabList>
      <TabContent value="code">
        <div className="p-4 text-icon5 font-mono text-sm">const hello = world;</div>
      </TabContent>
      <TabContent value="preview">
        <div className="p-4 text-icon5">Preview content</div>
      </TabContent>
      <TabContent value="output">
        <div className="p-4 text-icon5">Output content</div>
      </TabContent>
    </Tabs>
  ),
};

export const TwoTabs: Story = {
  render: () => (
    <Tabs defaultTab="input" className="w-[300px]">
      <TabList>
        <Tab value="input">Input</Tab>
        <Tab value="output">Output</Tab>
      </TabList>
      <TabContent value="input">
        <div className="p-4 text-icon5">Input content</div>
      </TabContent>
      <TabContent value="output">
        <div className="p-4 text-icon5">Output content</div>
      </TabContent>
    </Tabs>
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
        <div className="p-4 text-icon5">Content 1</div>
      </TabContent>
      <TabContent value="tab2">
        <div className="p-4 text-icon5">Content 2</div>
      </TabContent>
      <TabContent value="tab3">
        <div className="p-4 text-icon5">Content 3</div>
      </TabContent>
      <TabContent value="tab4">
        <div className="p-4 text-icon5">Content 4</div>
      </TabContent>
      <TabContent value="tab5">
        <div className="p-4 text-icon5">Content 5</div>
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
        <div className="p-4 text-icon5">index.ts content</div>
      </TabContent>
      <TabContent value="file2">
        <div className="p-4 text-icon5">utils.ts content</div>
      </TabContent>
      <TabContent value="file3">
        <div className="p-4 text-icon5">types.ts content</div>
      </TabContent>
    </Tabs>
  ),
};
