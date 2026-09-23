import type { Meta, StoryObj } from '@storybook/react-vite';
import { BracesIcon } from 'lucide-react';
import { fn } from 'storybook/test';

import { ThemeProvider } from '../ThemeProvider';
import { TooltipProvider } from '../Tooltip';
import { DataDetailsPanel } from './index';

const meta: Meta<typeof DataDetailsPanel> = {
  title: 'DataDisplay/DataDetailsPanel',
  component: DataDetailsPanel,
  parameters: { layout: 'centered' },
  decorators: [
    Story => (
      <ThemeProvider defaultTheme="dark" storageKey="storybook-data-details-panel">
        <TooltipProvider>
          <Story />
        </TooltipProvider>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DataDetailsPanel>;

const responseBody = JSON.stringify(
  {
    answer: 'The workflow completed successfully.\nAll three steps returned output.',
    duration: 842,
    cached: false,
  },
  null,
  2,
);

export const Populated: Story = {
  render: () => (
    <div className="h-136 w-160">
      <DataDetailsPanel>
        <DataDetailsPanel.Header>
          <DataDetailsPanel.Heading>
            Run <b>run_8f3a91b2</b>
          </DataDetailsPanel.Heading>
          <DataDetailsPanel.CloseButton onClick={fn()} />
        </DataDetailsPanel.Header>
        <DataDetailsPanel.Content>
          <div className="grid gap-6">
            <DataDetailsPanel.KeyValueList>
              <DataDetailsPanel.KeyValueList.Header>Execution</DataDetailsPanel.KeyValueList.Header>
              <DataDetailsPanel.KeyValueList.Key>Status</DataDetailsPanel.KeyValueList.Key>
              <DataDetailsPanel.KeyValueList.Value>Completed</DataDetailsPanel.KeyValueList.Value>
              <DataDetailsPanel.KeyValueList.Key>Agent</DataDetailsPanel.KeyValueList.Key>
              <DataDetailsPanel.KeyValueList.Value>
                Research agent with a realistically long display name
              </DataDetailsPanel.KeyValueList.Value>
              <DataDetailsPanel.KeyValueList.Key>Started</DataDetailsPanel.KeyValueList.Key>
              <DataDetailsPanel.KeyValueList.Value>August 26, 2026 at 21:42</DataDetailsPanel.KeyValueList.Value>
            </DataDetailsPanel.KeyValueList>
            <DataDetailsPanel.CodeSection title="Response" icon={<BracesIcon />} codeStr={responseBody} />
          </div>
        </DataDetailsPanel.Content>
      </DataDetailsPanel>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="h-72 w-144">
      <DataDetailsPanel>
        <DataDetailsPanel.Header>
          <DataDetailsPanel.Heading>Trace details</DataDetailsPanel.Heading>
        </DataDetailsPanel.Header>
        <DataDetailsPanel.LoadingData>Loading trace data...</DataDetailsPanel.LoadingData>
      </DataDetailsPanel>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="h-72 w-144">
      <DataDetailsPanel>
        <DataDetailsPanel.Header>
          <DataDetailsPanel.Heading>Trace details</DataDetailsPanel.Heading>
        </DataDetailsPanel.Header>
        <DataDetailsPanel.NoData>No attributes were recorded for this span.</DataDetailsPanel.NoData>
      </DataDetailsPanel>
    </div>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <div className="w-144">
      <DataDetailsPanel collapsed>
        <DataDetailsPanel.Header>
          <DataDetailsPanel.Heading>
            Run <b>run_8f3a91b2</b>
          </DataDetailsPanel.Heading>
          <DataDetailsPanel.CloseButton onClick={fn()} />
        </DataDetailsPanel.Header>
      </DataDetailsPanel>
    </div>
  ),
};
