import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { AgentIcon } from '../../icons/AgentIcon';
import { ApiIcon } from '../../icons/ApiIcon';
import { DebugIcon } from '../../icons/DebugIcon';
import { InfoIcon } from '../../icons/InfoIcon';
import { JudgeIcon } from '../../icons/JudgeIcon';
import { MemoryIcon } from '../../icons/MemoryIcon';
import { OpenAIIcon } from '../../icons/OpenAIIcon';
import { WorkflowIcon } from '../../icons/WorkflowIcon';
import { Badge } from '../Badge/Badge';

import { Table, Thead, Th, Row, Cell, Tbody, UnitCell, DateTimeCell, TxtCell, EntryCell } from '.';

const Observability = () => {
  return (
    <Table size="small">
      <Thead>
        <Th>Time</Th>
        <Th>Level</Th>
        <Th>Host</Th>
        <Th>Message</Th>
      </Thead>

      <Tbody>
        {Array.from({ length: 10 }).map((_, index) => (
          <Row key={index} selected={index === 3}>
            <DateTimeCell dateTime={new Date()} />

            <Cell>
              <Badge variant={index % 2 === 0 ? 'error' : 'info'} icon={index % 2 === 0 ? <DebugIcon /> : <InfoIcon />}>
                {index % 2 === 0 ? 'debug' : 'info'}
              </Badge>
            </Cell>

            <UnitCell unit="-lawyer-e44c5e6918aabd0af5990">fat-unkempt</UnitCell>
            <TxtCell>Message {index}</TxtCell>
          </Row>
        ))}
      </Tbody>
    </Table>
  );
};

const Agents = () => {
  return (
    <Table>
      <Thead>
        <Th>Name</Th>
        <Th>Model</Th>
        <Th>Memory</Th>
        <Th>Tools</Th>
        <Th>Judges</Th>
      </Thead>

      <Tbody>
        {Array.from({ length: 10 }).map((_, index) => (
          <Row key={index}>
            <EntryCell name="John Doe" description="Agent Prompt" icon={<AgentIcon />} />

            <Cell>
              <Badge variant="default" icon={<OpenAIIcon />}>
                gpt-4o
              </Badge>
            </Cell>

            <Cell>
              <Badge variant="success" icon={<MemoryIcon />}>
                On
              </Badge>
            </Cell>

            <Cell>
              <Badge variant="default" icon={<ApiIcon />}>
                4 tools
              </Badge>
            </Cell>

            <Cell>
              <Badge variant="default" icon={<JudgeIcon />}>
                2 judges
              </Badge>
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
  );
};

const Workflows = () => {
  return (
    <Table>
      <Thead>
        <Th>Name</Th>
        <Th>Av. Runtime</Th>
        <Th>Runs</Th>
        <Th>Steps</Th>
      </Thead>

      <Tbody>
        {Array.from({ length: 10 }).map((_, index) => (
          <Row key={index}>
            <EntryCell name="Workflow" icon={<WorkflowIcon />} />

            <UnitCell unit="ms">2.245</UnitCell>

            <UnitCell unit="runs">2.245&nbs;</UnitCell>

            <Cell>
              <Badge variant="default" icon={<WorkflowIcon />}>
                5 steps
              </Badge>
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
  );
};

const Judges = () => {
  return (
    <Table>
      <Thead>
        <Th>Name</Th>
        <Th>Model</Th>
        <Th>Assigned to</Th>
      </Thead>

      <Tbody>
        {Array.from({ length: 10 }).map((_, index) => (
          <Row key={index}>
            <EntryCell name="Judge" icon={<JudgeIcon />} meta={<Badge>LLM</Badge>} />

            <Cell>
              <Badge variant="default" icon={<OpenAIIcon />}>
                gpt-4o
              </Badge>
            </Cell>

            <Cell>
              <Badge variant="default" icon={<AgentIcon />}>
                2 agents
              </Badge>
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
  );
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Primitives/Table',
  component: Table,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {},

  args: {},
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const ObservabilityTable: Story = {
  args: {
    children: <Observability />,
  },
};

export const AgentsTable: Story = {
  args: {
    children: <Agents />,
  },
};

export const WorkflowsTable: Story = {
  args: {
    children: <Workflows />,
  },
};

export const JudgesTable: Story = {
  args: {
    children: <Judges />,
  },
};
