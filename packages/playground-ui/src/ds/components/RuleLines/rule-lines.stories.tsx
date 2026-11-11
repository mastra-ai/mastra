import type { Meta, StoryObj } from '@storybook/react-vite';
import { ListPlus, Plus } from 'lucide-react';
import { useState } from 'react';

import {
  RuleAddButton,
  RuleLine,
  RuleLineContent,
  RuleLineGroup,
  RuleLineGroupRemove,
  RuleLineHint,
  RuleLineKeyword,
  RuleLineLogic,
  RuleLineRemove,
  RuleLines,
} from './rule-lines';
import type { RuleLogic } from './rule-lines';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';

const meta: Meta<typeof RuleLines> = {
  title: 'Elements/RuleLines',
  component: RuleLines,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof RuleLines>;

function Picker({ label, value, items }: { label: string; value: string; items: string[] }) {
  return (
    <Select defaultValue={value}>
      <SelectTrigger size="sm" aria-label={label} className="w-fit">
        {value}
      </SelectTrigger>
      <SelectContent>
        {items.map(item => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddButtons() {
  return (
    <>
      <RuleAddButton icon={<Plus />}>Add condition</RuleAddButton>
      <RuleAddButton icon={<ListPlus />}>Add group</RuleAddButton>
    </>
  );
}

function Conditions() {
  const [logic, setLogic] = useState<RuleLogic>('AND');
  const [inner, setInner] = useState<RuleLogic>('OR');
  return (
    <RuleLines role="group" aria-label="Start only when" className="max-w-2xl">
      <RuleLine>
        <RuleLineKeyword>Where</RuleLineKeyword>
        <RuleLineContent>
          <Picker label="Field" value="Labels" items={['Labels', 'Author', 'Title']} />
          <Picker label="Operator" value="is any of" items={['is any of', 'is none of']} />
          <Picker label="Values" value="Bug or Feature" items={['Bug or Feature', 'Chore']} />
          <RuleLineRemove aria-label="Remove condition" />
        </RuleLineContent>
      </RuleLine>
      <RuleLine>
        <RuleLineLogic value={logic} onValueChange={setLogic} />
        <RuleLineGroup depth={0} aria-label={inner === 'AND' ? 'All of these' : 'Any of these'}>
          <RuleLines>
            <RuleLine>
              <RuleLineKeyword>Where</RuleLineKeyword>
              <RuleLineContent>
                <Picker label="Field" value="Author" items={['Labels', 'Author', 'Title']} />
                <Picker label="Operator" value="is" items={['is', 'is not']} />
                <Picker label="Value" value="octocat" items={['octocat', 'mona']} />
                <RuleLineRemove aria-label="Remove condition" />
              </RuleLineContent>
            </RuleLine>
            <RuleLine>
              <RuleLineLogic value={inner} onValueChange={setInner} />
              <RuleLineContent>
                <Picker label="Field" value="Title" items={['Labels', 'Author', 'Title']} />
                <Picker label="Operator" value="contains" items={['contains', 'is']} />
                <Picker label="Value" value="urgent" items={['urgent', 'later']} />
                <RuleLineRemove aria-label="Remove condition" />
              </RuleLineContent>
            </RuleLine>
            <RuleLine>
              <RuleLineKeyword />
              <RuleLineContent>
                <AddButtons />
                <RuleLineGroupRemove>Remove group</RuleLineGroupRemove>
              </RuleLineContent>
            </RuleLine>
          </RuleLines>
        </RuleLineGroup>
      </RuleLine>
      <RuleLine>
        <RuleLineKeyword />
        <RuleLineContent>
          <AddButtons />
        </RuleLineContent>
      </RuleLine>
    </RuleLines>
  );
}

export const Default: Story = {
  render: () => <Conditions />,
};

export const Empty: Story = {
  render: () => (
    <RuleLines role="group" aria-label="Start only when">
      <RuleLine>
        <RuleLineKeyword>Where</RuleLineKeyword>
        <RuleLineContent>
          <AddButtons />
          <RuleLineHint>Matches every card.</RuleLineHint>
        </RuleLineContent>
      </RuleLine>
    </RuleLines>
  ),
};
