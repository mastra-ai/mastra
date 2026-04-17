import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataPanel } from './data-panel';
import { TooltipProvider } from '../Tooltip';
import type { DataPanelProps } from './data-panel-root';

const meta: Meta<typeof DataPanel> = {
  title: 'Composite/DataPanel',
  component: DataPanel,
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="h-[500px] w-[400px]">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<DataPanelProps>;

export const Default: Story = {
  render: () => (
    <DataPanel>
      <DataPanel.Header>
        <DataPanel.Heading>Span Details</DataPanel.Heading>
        <DataPanel.CloseButton onClick={() => {}} />
      </DataPanel.Header>
      <DataPanel.Content>
        <p className="text-ui-sm text-neutral3">Panel content goes here.</p>
      </DataPanel.Content>
    </DataPanel>
  ),
};

export const WithNavigation: Story = {
  render: () => (
    <DataPanel>
      <DataPanel.Header>
        <DataPanel.Heading>
          <b>Trace</b> abc123
        </DataPanel.Heading>
        <div className="flex items-center gap-2">
          <DataPanel.NextPrevNav onPrevious={() => {}} onNext={() => {}} />
          <DataPanel.CloseButton onClick={() => {}} />
        </div>
      </DataPanel.Header>
      <DataPanel.Content>
        <p className="text-ui-sm text-neutral3">Navigate between items with the arrows.</p>
      </DataPanel.Content>
    </DataPanel>
  ),
};

export const NoData: Story = {
  render: () => (
    <DataPanel>
      <DataPanel.Header>
        <DataPanel.Heading>Empty Panel</DataPanel.Heading>
        <DataPanel.CloseButton onClick={() => {}} />
      </DataPanel.Header>
      <DataPanel.NoData />
    </DataPanel>
  ),
};

export const Loading: Story = {
  render: () => (
    <DataPanel>
      <DataPanel.Header>
        <DataPanel.Heading>Loading Panel</DataPanel.Heading>
        <DataPanel.CloseButton onClick={() => {}} />
      </DataPanel.Header>
      <DataPanel.LoadingData>Fetching trace data...</DataPanel.LoadingData>
    </DataPanel>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <DataPanel collapsed>
      <DataPanel.Header>
        <DataPanel.Heading>Collapsed Panel</DataPanel.Heading>
        <DataPanel.CloseButton onClick={() => {}} />
      </DataPanel.Header>
      <DataPanel.Content>
        <p className="text-ui-sm text-neutral3">This panel uses h-auto instead of h-full.</p>
      </DataPanel.Content>
    </DataPanel>
  ),
};

export const DisabledNav: Story = {
  render: () => (
    <DataPanel>
      <DataPanel.Header>
        <DataPanel.Heading>
          <b>First Item</b> (no previous)
        </DataPanel.Heading>
        <div className="flex items-center gap-2">
          <DataPanel.NextPrevNav onNext={() => {}} />
          <DataPanel.CloseButton onClick={() => {}} />
        </div>
      </DataPanel.Header>
      <DataPanel.Content>
        <p className="text-ui-sm text-neutral3">Previous button is disabled because onPrevious is undefined.</p>
      </DataPanel.Content>
    </DataPanel>
  ),
};
