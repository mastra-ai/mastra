import { useId, useState } from 'react';
import { Checkbox } from '@/ds/components/Checkbox';
import { Label } from '@/ds/components/Label';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';

export function FocusTabs() {
  return (
    <div className="grid gap-6">
      {(['pill', 'pill-ghost', 'line'] as const).map(variant => (
        <Tabs key={variant} defaultTab="overview">
          <TabList variant={variant} aria-label={`${variant} tabs`}>
            <Tab value="overview">Overview</Tab>
            <Tab value="traces">Traces</Tab>
            <Tab value="settings" disabled>
              Settings
            </Tab>
          </TabList>
          <TabContent value="overview">{variant} overview</TabContent>
          <TabContent value="traces">{variant} traces</TabContent>
        </Tabs>
      ))}
      {(['stroke', 'inset'] as const).map(frame => (
        <Tabs key={frame} appearance="contained" frame={frame} defaultTab="overview">
          <TabList aria-label={`${frame} tabs`}>
            <Tab value="overview">Overview</Tab>
            <Tab value="traces">Traces</Tab>
          </TabList>
          <TabContent value="overview">{frame} overview</TabContent>
          <TabContent value="traces">{frame} traces</TabContent>
        </Tabs>
      ))}
    </div>
  );
}

const agents = ['Support agent', 'Research agent', 'Writing agent'];

export function FocusTable() {
  const id = useId();
  const [selection, setSelection] = useState(new Set(['Support agent']));
  const [openedAgent, setOpenedAgent] = useState('None');
  function selectAgent(agent: string, checked: boolean) {
    setSelection(current => {
      const next = new Set(current);
      if (checked) next.add(agent);
      else next.delete(agent);
      return next;
    });
  }
  return (
    <div className="grid gap-5">
      <Table>
        <caption className="sr-only">Select agents</caption>
        <Thead>
          <Th className="w-12">
            <Checkbox
              aria-label="Select all agents"
              checked={selection.size === agents.length}
              indeterminate={selection.size > 0 && selection.size < agents.length}
              onCheckedChange={checked => setSelection(new Set(checked ? agents : []))}
            />
          </Th>
          <Th>Agent</Th>
        </Thead>
        <Tbody>
          {agents.map(agent => (
            <Row key={agent} selected={selection.has(agent)}>
              <Cell>
                <Checkbox
                  id={`${id}-${agent}`}
                  aria-label={`Select ${agent}`}
                  checked={selection.has(agent)}
                  onCheckedChange={checked => selectAgent(agent, checked)}
                />
              </Cell>
              <Cell>
                <Label htmlFor={`${id}-${agent}`}>{agent}</Label>
              </Cell>
            </Row>
          ))}
        </Tbody>
      </Table>
      <p role="status" className="text-ui-sm text-neutral3">
        {selection.size} selected
      </p>
      <Table>
        <caption className="sr-only">Open agents</caption>
        <Tbody>
          {agents.map(agent => (
            <Row key={agent} selected={agent === openedAgent} onClick={() => setOpenedAgent(agent)}>
              <Cell>{agent}</Cell>
            </Row>
          ))}
        </Tbody>
      </Table>
      <p role="status" className="text-ui-sm text-neutral3">
        Opened: {openedAgent}
      </p>
    </div>
  );
}
