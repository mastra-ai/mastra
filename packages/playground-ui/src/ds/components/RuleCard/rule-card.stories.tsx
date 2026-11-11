import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import {
  RuleCard,
  RuleCardBody,
  RuleCardDragHandle,
  RuleCardHeader,
  RuleCardOutcome,
  RuleCardStep,
  RuleCardTitle,
  RuleCardTitleInput,
} from './rule-card';
import { Button } from '@/ds/components/Button';
import { RuleAddButton, RuleLine, RuleLineContent, RuleLineKeyword, RuleLines } from '@/ds/components/RuleLines';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';
import { Switch } from '@/ds/components/Switch';
import { IconDotGrid1x3Horizontal } from '@/ds/icons/central/IconDotGrid1x3Horizontal';
import { IconPlusLarge } from '@/ds/icons/central/IconPlusLarge';

const meta: Meta<typeof RuleCard> = {
  title: 'Elements/RuleCard',
  component: RuleCard,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof RuleCard>;

function Picker({ label, value }: { label: string; value: string }) {
  return (
    <Select defaultValue={value}>
      <SelectTrigger size="sm" aria-label={label} className="w-fit">
        {value}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={value}>{value}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function Route({ step, initialName }: { step: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [enabled, setEnabled] = useState(true);
  return (
    <RuleCard inactive={!enabled}>
      <RuleCardHeader>
        <RuleCardDragHandle aria-label={`Reorder ${name}`} />
        <RuleCardStep>{step}</RuleCardStep>
        <RuleCardTitleInput aria-label="Route name" value={name} onChange={event => setName(event.target.value)} />
        <Switch aria-label={`Use ${name}`} checked={enabled} onCheckedChange={setEnabled} />
        <Button variant="ghost" size="icon-sm" aria-label={`${name} actions`}>
          <IconDotGrid1x3Horizontal />
        </Button>
      </RuleCardHeader>
      <RuleCardBody>
        <RuleLines role="group" aria-label={`${name} conditions`}>
          <RuleLine>
            <RuleLineKeyword>Where</RuleLineKeyword>
            <RuleLineContent>
              <Picker label="Field" value="Labels" />
              <Picker label="Operator" value="is any of" />
              <Picker label="Values" value="Bug" />
            </RuleLineContent>
          </RuleLine>
        </RuleLines>
      </RuleCardBody>
      <RuleCardOutcome label="Send to">
        <Picker label="Board" value="Work" />
        <Picker label="Phase" value="Triage" />
      </RuleCardOutcome>
    </RuleCard>
  );
}

export const Default: Story = {
  render: () => (
    <ol aria-label="Intake routes" className="flex max-w-2xl flex-col gap-5">
      <li>
        <Route step="If" initialName="Bugs" />
      </li>
      <li>
        <Route step="Else if" initialName="Features" />
      </li>
      <li className="pl-4">
        <RuleAddButton icon={<IconPlusLarge />}>Add route</RuleAddButton>
      </li>
    </ol>
  ),
};

export const ReadOnly: Story = {
  render: () => (
    <RuleCard className="max-w-2xl">
      <RuleCardHeader>
        <RuleCardStep>Otherwise</RuleCardStep>
        <RuleCardTitle>Everything else</RuleCardTitle>
      </RuleCardHeader>
      <RuleCardOutcome label="Send to">
        <Picker label="Board" value="Work" />
      </RuleCardOutcome>
    </RuleCard>
  ),
};
