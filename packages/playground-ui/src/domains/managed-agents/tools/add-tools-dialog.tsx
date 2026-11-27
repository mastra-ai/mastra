import type { ReactNode } from 'react';
import { useState } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { SearchInput } from '@/ds/components/SearchInput';
import { Txt } from '@/ds/components/Txt';
import { SettingsContainer } from '@/ds/new/settings/settings-container';

export interface CatalogTool {
  id: string;
  name: string;
  description: string;
  logo: ReactNode;
  connected: boolean;
}

export interface AddToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: CatalogTool[];
  onAdd: (ids: string[]) => void;
}

function matches(tool: CatalogTool, query: string) {
  const needle = query.trim().toLowerCase();
  return tool.name.toLowerCase().includes(needle) || tool.description.toLowerCase().includes(needle);
}

function CatalogRow({
  tool,
  checked,
  onCheckedChange,
}: {
  tool: CatalogTool;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span aria-hidden="true" className="flex shrink-0">
        {tool.logo}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <Txt as="span" variant="label" tone="ink">
            {tool.name}
          </Txt>
          {tool.connected ? (
            <Badge variant="success" emphasis="subtle" size="sm">
              Connected
            </Badge>
          ) : null}
        </span>
        <Txt as="span" variant="caption" tone="muted" className="truncate">
          {tool.description}
        </Txt>
      </span>
      <Checkbox aria-label={tool.name} checked={checked} onCheckedChange={next => onCheckedChange(next === true)} />
    </label>
  );
}

function AddToolsForm({
  catalog,
  onAdd,
  onCancel,
}: Pick<AddToolsDialogProps, 'catalog' | 'onAdd'> & { onCancel: () => void }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const shown = catalog.filter(tool => matches(tool, query));
  const toggle = (id: string, checked: boolean) =>
    setPicked(checked ? [...picked, id] : picked.filter(pickedId => pickedId !== id));

  return (
    <>
      <DialogBody>
        <SearchInput label="Search tools" placeholder="Search tools" value={query} onValueChange={setQuery} />
        {shown.length > 0 ? (
          <SettingsContainer aria-label="Available tools" role="group">
            {shown.map(tool => (
              <CatalogRow
                key={tool.id}
                tool={tool}
                checked={picked.includes(tool.id)}
                onCheckedChange={checked => toggle(tool.id, checked)}
              />
            ))}
          </SettingsContainer>
        ) : (
          <Txt variant="body-sm" tone="muted">
            No tools match “{query}”.
          </Txt>
        )}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={picked.length === 0} onClick={() => onAdd(picked)}>
          {picked.length > 1 ? `Add ${picked.length} tools` : 'Add tool'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AddToolsDialog({ open, onOpenChange, catalog, onAdd }: AddToolsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add tools</DialogTitle>
        </DialogHeader>
        <AddToolsForm
          catalog={catalog}
          onCancel={() => onOpenChange(false)}
          onAdd={ids => {
            onAdd(ids);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
