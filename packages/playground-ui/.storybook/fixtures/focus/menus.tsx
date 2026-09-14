import { useState } from 'react';
import { Combobox } from '@/ds/components/Combobox';
import { Command, CommandInput, CommandItem, CommandList } from '@/ds/components/Command';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';

const agents = [
  { label: 'Support agent', value: 'support' },
  { label: 'Research agent', value: 'research' },
  { label: 'Writing agent', value: 'writing' },
];

export function FocusSelects() {
  return (
    <div className="grid gap-5">
      {(['default', 'outline', 'ghost'] as const).map(variant => (
        <Select key={variant} defaultValue="support">
          <SelectTrigger variant={variant} aria-label={`${variant} agent`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {agents.map(agent => (
              <SelectItem key={agent.value} value={agent.value}>
                {agent.label}
              </SelectItem>
            ))}
            <SelectItem value="disabled" disabled>
              Disabled agent
            </SelectItem>
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}

export function FocusComboboxes() {
  const [agent, setAgent] = useState('support');
  const [selection, setSelection] = useState<string[]>(['research']);
  return (
    <div className="grid gap-5">
      <Combobox aria-label="Agent" options={agents} value={agent} onValueChange={setAgent} />
      <Combobox aria-label="Agents" multiple options={agents} value={selection} onValueChange={setSelection} />
      <Combobox aria-label="Compact agent" options={agents} size="icon-md" value={agent} onValueChange={setAgent} />
    </div>
  );
}

export function FocusDropdownMenu() {
  const [action, setAction] = useState('No action chosen');
  return (
    <div className="grid justify-items-start gap-4">
      <DropdownMenu>
        <DropdownMenu.Trigger>Agent actions</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onSelect={() => setAction('Agent duplicated')}>Duplicate</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => setAction('Agent exported')}>Export</DropdownMenu.Item>
          <DropdownMenu.Item disabled>Archive</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
      <p role="status" className="text-ui-sm text-neutral3">
        {action}
      </p>
    </div>
  );
}

export function FocusCommands() {
  const [action, setAction] = useState('No command chosen');
  return (
    <div className="grid gap-4">
      <Command label="Agent commands">
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandItem onSelect={() => setAction('Create agent selected')}>Create agent</CommandItem>
          <CommandItem onSelect={() => setAction('View traces selected')}>View traces</CommandItem>
          <CommandItem disabled>Delete workspace</CommandItem>
        </CommandList>
      </Command>
      <p role="status" className="text-ui-sm text-neutral3">
        {action}
      </p>
    </div>
  );
}
