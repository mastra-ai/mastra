import { useState } from 'react';
import { CatalogRow } from './catalog-row';
import type { CatalogTool } from './catalog-tool';
import { Button } from '@/ds/components/Button';
import { DialogBody, DialogFooter } from '@/ds/components/Dialog';
import { SearchInput } from '@/ds/components/SearchInput';
import { Txt } from '@/ds/components/Txt';
import { SettingsContainer } from '@/ds/new/settings/settings-container';

function matches(tool: CatalogTool, query: string) {
  const needle = query.trim().toLowerCase();
  return tool.name.toLowerCase().includes(needle) || tool.description.toLowerCase().includes(needle);
}

export function AddToolsForm({
  catalog,
  onAdd,
  onCancel,
}: {
  catalog: CatalogTool[];
  onAdd: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const pickedIds = new Set(picked);
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
                checked={pickedIds.has(tool.id)}
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
