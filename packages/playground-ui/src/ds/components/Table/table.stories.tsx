import type { Meta, StoryObj } from '@storybook/react-vite';
import { Table, Thead, Th, Tbody, Row } from './Table';
import { Cell, TxtCell, DateTimeCell, EntryCell } from './Cells';
import { Badge } from '../Badge';
import { Bot, Workflow } from 'lucide-react';

const meta: Meta<typeof Table> = {
  title: 'DataDisplay/Table',
  component: Table,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['default', 'small'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => (
    <div className="w-[600px]">
      <Table>
        <Thead>
          <Th>Name</Th>
          <Th>Status</Th>
          <Th>Created</Th>
        </Thead>
        <Tbody>
          <Row>
            <TxtCell>Item One</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
            <TxtCell>Jan 14, 2026</TxtCell>
          </Row>
          <Row>
            <TxtCell>Item Two</TxtCell>
            <Cell>
              <Badge variant="default">Pending</Badge>
            </Cell>
            <TxtCell>Jan 13, 2026</TxtCell>
          </Row>
          <Row>
            <TxtCell>Item Three</TxtCell>
            <Cell>
              <Badge variant="error">Error</Badge>
            </Cell>
            <TxtCell>Jan 12, 2026</TxtCell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const SmallSize: Story = {
  render: () => (
    <div className="w-[600px]">
      <Table size="small">
        <Thead>
          <Th>Name</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          <Row>
            <TxtCell>Item One</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
          <Row>
            <TxtCell>Item Two</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const WithDateTimeCell: Story = {
  render: () => (
    <div className="w-[600px]">
      <Table>
        <Thead>
          <Th>Event</Th>
          <Th>Timestamp</Th>
        </Thead>
        <Tbody>
          <Row>
            <TxtCell>Agent started</TxtCell>
            <DateTimeCell dateTime={new Date()} />
          </Row>
          <Row>
            <TxtCell>Workflow completed</TxtCell>
            <DateTimeCell dateTime={new Date(Date.now() - 3600000)} />
          </Row>
          <Row>
            <TxtCell>Error logged</TxtCell>
            <DateTimeCell dateTime={new Date(Date.now() - 86400000)} />
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const WithEntryCell: Story = {
  render: () => (
    <div className="w-[700px]">
      <Table>
        <Thead>
          <Th>Agent</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          <Row>
            <EntryCell name="Customer Support Agent" description="Handles customer inquiries" icon={<Bot />} />
            <Cell>
              <Badge variant="success">Online</Badge>
            </Cell>
          </Row>
          <Row>
            <EntryCell name="Data Analysis Agent" description="Processes analytics data" icon={<Bot />} />
            <Cell>
              <Badge variant="default">Idle</Badge>
            </Cell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const ClickableRows: Story = {
  render: () => (
    <div className="w-[600px]">
      <Table>
        <Thead>
          <Th>Name</Th>
          <Th>Type</Th>
        </Thead>
        <Tbody>
          <Row onClick={() => console.log('Row 1 clicked')}>
            <TxtCell>Clickable Row 1</TxtCell>
            <TxtCell>Type A</TxtCell>
          </Row>
          <Row onClick={() => console.log('Row 2 clicked')}>
            <TxtCell>Clickable Row 2</TxtCell>
            <TxtCell>Type B</TxtCell>
          </Row>
          <Row onClick={() => console.log('Row 3 clicked')}>
            <TxtCell>Clickable Row 3</TxtCell>
            <TxtCell>Type C</TxtCell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const SelectedRow: Story = {
  render: () => (
    <div className="w-[600px]">
      <Table>
        <Thead>
          <Th>Name</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          <Row>
            <TxtCell>Regular Row</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
          <Row selected>
            <TxtCell>Selected Row</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
          <Row>
            <TxtCell>Regular Row</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};
