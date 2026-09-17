import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button';
import { TooltipProvider } from '../Tooltip';
import { DataPanel } from './data-panel';
import type { DataPanelProps } from './data-panel-root';

const meta: Meta<typeof DataPanel> = {
  title: 'Composite/DataPanel',
  component: DataPanel,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'Detail panel rendered as a Base UI Drawer dialog: portaled to the right edge of the page,',
          'with backdrop, focus trap, Escape / backdrop-click / swipe dismissal.',
          'The Drawer is an implementation detail — the visible chrome is the DataPanel itself.',
          '',
          'Rendering a `DataPanel` inside another one stacks them natively (Base UI nested drawers).',
          '',
          'This is the pattern behind the observability trace / span / log detail views, shared by',
          'both the local Studio and Cloud Studio. For a wide modal with a hidden close tab, see `Layout/SideDialog`.',
        ].join('\n'),
      },
    },
  },
};

export default meta;
type Story = StoryObj<DataPanelProps>;

export const Default: Story = {
  render: () => (
    <DataPanel open title="Span details">
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
    <DataPanel open title="Trace abc123">
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
    <DataPanel open title="Empty panel">
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
    <DataPanel open title="Loading panel">
      <DataPanel.Header>
        <DataPanel.Heading>Loading Panel</DataPanel.Heading>
        <DataPanel.CloseButton onClick={() => {}} />
      </DataPanel.Header>
      <DataPanel.LoadingData>Fetching trace data...</DataPanel.LoadingData>
    </DataPanel>
  ),
};

export const Wide: Story = {
  render: () => (
    <DataPanel open title="Wide panel" size="wide">
      <DataPanel.Header>
        <DataPanel.Heading>Wide Panel</DataPanel.Heading>
        <DataPanel.CloseButton onClick={() => {}} />
      </DataPanel.Header>
      <DataPanel.Content>
        <p className="text-ui-sm text-neutral3">
          <code>size=&quot;wide&quot;</code> takes 80% of the viewport for multi-column content;{' '}
          <code>size=&quot;full&quot;</code> covers it entirely.
        </p>
      </DataPanel.Content>
    </DataPanel>
  ),
};

export const DisabledNav: Story = {
  render: () => (
    <DataPanel open title="First item">
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

const StackedDemo = () => {
  const [outerOpen, setOuterOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setOuterOpen(true)}>Open span details</Button>

      <DataPanel open={outerOpen} onClose={() => setOuterOpen(false)} title="Span details">
        <DataPanel.Header>
          <DataPanel.Heading>
            <b>Span</b> agent.generate
          </DataPanel.Heading>
          <DataPanel.CloseButton onClick={() => setOuterOpen(false)} />
        </DataPanel.Header>
        <DataPanel.Content>
          <p className="text-ui-sm text-neutral3">
            Escape, backdrop click or the close button dismiss this panel. Open a nested panel to stack a second one on
            top.
          </p>
          <Button onClick={() => setInnerOpen(true)}>Open nested panel</Button>

          <DataPanel
            open={innerOpen}
            onClose={() => setInnerOpen(false)}
            title="Score details"
            className="ml-auto w-80"
          >
            <DataPanel.Header>
              <DataPanel.Heading>
                <b>Score</b> answer-relevancy
              </DataPanel.Heading>
              <DataPanel.CloseButton onClick={() => setInnerOpen(false)} />
            </DataPanel.Header>
            <DataPanel.Content>
              <p className="text-ui-sm text-neutral3">
                Escape only closes this top-most panel; the parent stays open underneath.
              </p>
            </DataPanel.Content>
          </DataPanel>
        </DataPanel.Content>
      </DataPanel>
    </div>
  );
};

export const Stacked: Story = {
  render: () => <StackedDemo />,
};

const SiblingsWithDepthDemo = () => {
  const [resultOpen, setResultOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);

  const closeResult = () => {
    setScoreOpen(false);
    setResultOpen(false);
  };

  return (
    <div className="p-8">
      <Button onClick={() => setResultOpen(true)}>Open result</Button>

      <DataPanel open={resultOpen} onClose={closeResult} title="Result" depth={1}>
        <DataPanel.Header>
          <DataPanel.Heading>
            <b>Result</b> item-42
          </DataPanel.Heading>
          <DataPanel.CloseButton onClick={closeResult} />
        </DataPanel.Header>
        <DataPanel.Content>
          <p className="text-ui-sm text-neutral3">
            The score panel is a <b>sibling</b> drawer (not nested in the DOM) rendered after this one with a higher{' '}
            <code>depth</code>, so it is narrower and this panel peeks out on the left.
          </p>
          <Button onClick={() => setScoreOpen(true)}>Open score</Button>
        </DataPanel.Content>
      </DataPanel>

      <DataPanel open={scoreOpen} onClose={() => setScoreOpen(false)} title="Score" depth={2}>
        <DataPanel.Header>
          <DataPanel.Heading>
            <b>Score</b> answer-relevancy
          </DataPanel.Heading>
          <DataPanel.CloseButton onClick={() => setScoreOpen(false)} />
        </DataPanel.Header>
        <DataPanel.Content>
          <p className="text-ui-sm text-neutral3">Escape closes this panel first; the result stays open beneath.</p>
        </DataPanel.Content>
      </DataPanel>
    </div>
  );
};

export const SiblingsWithDepth: Story = {
  render: () => <SiblingsWithDepthDemo />,
};
