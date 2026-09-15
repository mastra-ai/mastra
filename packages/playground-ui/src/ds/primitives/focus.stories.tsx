import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileInput, Plus, Workflow } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/Button/Button';
import { Checkbox } from '../components/Checkbox/checkbox';
import { Combobox } from '../components/Combobox/combobox';
import { DataList } from '../components/DataList/data-list';
import { Input } from '../components/Input/input';
import { Tab, TabList, Tabs } from '../components/Tabs';
import { AgentIcon } from '../icons/AgentIcon';

const meta = {
  title: 'Primitives/Focus',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Keyboard focus regression fixtures. Use Tab and Shift+Tab to inspect focus; pointer clicks should leave decorative indicators hidden. Check both themes, reduced motion, and forced colors.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScrollBoundary: Story = {
  render: () => (
    <div
      className="bg-surface3 relative overflow-auto"
      style={{ width: 100, height: 100 }}
      data-testid="scroll-boundary"
    >
      <Button size="icon-sm" className="absolute right-0 bottom-0" aria-label="Add item">
        <Plus />
      </Button>
    </div>
  ),
};

export const ComboboxInteraction: Story = {
  render: function ComboboxInteractionStory() {
    const [value, setValue] = useState('');
    return (
      <div className="flex w-64 flex-col gap-4">
        <Combobox
          aria-label="Framework"
          value={value}
          onValueChange={setValue}
          options={[
            { label: 'React', value: 'react' },
            { label: 'Vue', value: 'vue' },
          ]}
        />
        <Input aria-label="Project name" placeholder="Project name" />
      </div>
    );
  },
};

export const RowAndActions: Story = {
  render: () => (
    <div className="w-80">
      <DataList columns="auto 1fr auto" fit="container">
        <DataList.RowWrapper data-testid="row">
          <DataList.Cell>
            <Checkbox aria-label="Select run" />
          </DataList.Cell>
          <DataList.RowButton colStart={2} colEnd={-2}>
            <DataList.NameCell>Workflow run</DataList.NameCell>
          </DataList.RowButton>
          <DataList.ActionsCell>
            <Button size="icon-sm" aria-label="Inspect run">
              <Plus />
            </Button>
          </DataList.ActionsCell>
        </DataList.RowWrapper>
      </DataList>
    </div>
  ),
};

export const DisabledTabExplanation: Story = {
  render: () => (
    <Tabs defaultTab="chat">
      <TabList variant="pill-ghost">
        <Tab value="chat">Chat</Tab>
        <Tab value="evaluate" disabled disabledTooltip="Add observability to enable this tab.">
          Evaluate
        </Tab>
      </TabList>
    </Tabs>
  ),
};

export const NativeFallback: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <button type="button" className="rounded-md px-2 py-1">
        Native action
      </button>
      <a href="#details" className="rounded-md px-2 py-1">
        Native link
      </a>
      <Button>Design system action</Button>
      <Input aria-label="Name" placeholder="Name" />
    </div>
  ),
};

export const HeaderTooltips: Story = {
  render: () => (
    <div className="w-full max-w-lg">
      <DataList columns="minmax(0,1fr) auto auto" fit="container">
        <DataList.Top>
          <DataList.TopCell>Scorer</DataList.TopCell>
          <DataList.TopCellSmart long="Agents" short={<AgentIcon />} shortIsIcon tooltip="Number of attached Agents" />
          <DataList.TopCellSmart
            long="Workflows"
            short={<Workflow />}
            shortIsIcon
            tooltip="Number of attached Workflows"
          />
        </DataList.Top>
        <DataList.RowStatic>
          <DataList.TextCell>Answer relevance</DataList.TextCell>
          <DataList.TextCell>1</DataList.TextCell>
          <DataList.TextCell>0</DataList.TextCell>
        </DataList.RowStatic>
      </DataList>
    </div>
  ),
};

export const MixedHeaderTooltip: Story = {
  render: () => (
    <div className="w-full max-w-lg">
      <DataList columns="minmax(0,1fr) auto" fit="container">
        <DataList.Top>
          <DataList.TopCell>Processor</DataList.TopCell>
          <DataList.TopCellSmart
            long="Input Step"
            short={
              <>
                <FileInput /> Step
              </>
            }
            tooltip="Contains Input Step phase"
          />
        </DataList.Top>
        <DataList.RowStatic>
          <DataList.TextCell>Input processor</DataList.TextCell>
          <DataList.TextCell>Yes</DataList.TextCell>
        </DataList.RowStatic>
      </DataList>
    </div>
  ),
};
