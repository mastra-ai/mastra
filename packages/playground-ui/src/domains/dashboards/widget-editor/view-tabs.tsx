import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { HintButton } from './hint-button';
import { Button } from '@/ds/components/Button';
import { Field, FieldError, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';

export type ViewTabsProps = {
  labels: string[];
  active: number;
  onActiveChange: (index: number) => void;
  onAdd: () => void;
  onRename: (index: number, label: string) => void;
  onDelete: (index: number) => void;
};

/**
 * The widget's views as tabs, shown even for one. Rename and delete act on the active tab and sit
 * beside the list: a button inside a tab would nest interactive roles.
 */
export function ViewTabs({ labels, active, onActiveChange, onAdd, onRename, onDelete }: ViewTabsProps) {
  const single = labels.length === 1;
  const current = labels[active] ?? '';
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <Tabs defaultTab="0" value={String(active)} onValueChange={value => onActiveChange(Number(value))}>
          <TabList size="sm" variant="pill-ghost">
            {labels.map((label, i) => (
              <Tab key={i} value={String(i)}>
                {label || `View ${i + 1}`}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      </div>
      <RenameView
        key={active}
        label={current}
        taken={labels.filter((_, i) => i !== active)}
        disabled={single}
        onRename={label => onRename(active, label)}
      />
      <HintButton
        size="icon-sm"
        variant="ghost"
        disabled={single}
        hint={single ? 'A widget keeps at least one view.' : `Delete “${current}”`}
        onClick={() => onDelete(active)}
      >
        <Trash2Icon />
      </HintButton>
      <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={onAdd}>
        Add view
      </Button>
    </div>
  );
}

type RenameViewProps = {
  label: string;
  /** Labels of the other views; a view's label is unique. */
  taken: string[];
  disabled: boolean;
  onRename: (label: string) => void;
};

function RenameView({ label, taken, disabled, onRename }: RenameViewProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(label);
  const trimmed = name.trim();
  const error = !trimmed
    ? 'Give the view a name.'
    : taken.includes(trimmed)
      ? 'Another view has this name.'
      : undefined;

  if (disabled) {
    return (
      <HintButton
        size="icon-sm"
        variant="ghost"
        disabled
        hint="With one view the page shows no tabs, so its name isn't shown. Add a view to rename."
      >
        <PencilIcon />
      </HintButton>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (next) setName(label);
      }}
    >
      <PopoverTrigger variant="ghost" size="icon-sm" tooltip={`Rename “${label}”`} aria-label={`Rename “${label}”`}>
        <PencilIcon />
      </PopoverTrigger>
      <PopoverContent align="end">
        <form
          className="flex flex-col gap-3"
          onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            if (error) return;
            onRename(trimmed);
            setOpen(false);
          }}
        >
          <Field invalid={!!error}>
            <FieldLabel>View name</FieldLabel>
            <Input size="sm" autoFocus value={name} onChange={event => setName(event.target.value)} />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" type="submit" disabled={!!error}>
              Rename
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
