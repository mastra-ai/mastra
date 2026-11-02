import { CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Field, FieldError } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Popover, PopoverContent } from '@/ds/components/Popover';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';

export type ViewTabsProps = {
  labels: string[];
  active: number;
  onActiveChange: (index: number) => void;
  onAdd: () => void;
  onRename: (index: number, label: string) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
};

/**
 * The widget's views as tabs, shown even for one. Like Notion's database views, clicking the active
 * tab opens its menu: rename in place, duplicate, delete.
 */
export function ViewTabs({ labels, active, onActiveChange, onAdd, onRename, onDuplicate, onDelete }: ViewTabsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  // Selecting a tab re-renders before its click lands, so remember whether it was already active
  // when the press started: only a press on the active tab opens the menu.
  const pressedActive = useRef(false);

  return (
    <div className="flex items-center gap-1">
      <Tabs defaultTab="0" value={String(active)} onValueChange={value => onActiveChange(Number(value))}>
        <TabList size="sm" variant="pill-ghost">
          {labels.map((label, i) => {
            const isActive = i === active;
            return (
              <span
                key={i}
                ref={isActive ? anchor : undefined}
                className="inline-flex"
                onPointerDownCapture={() => (pressedActive.current = isActive)}
                onKeyDownCapture={() => (pressedActive.current = isActive)}
              >
                <Tab
                  value={String(i)}
                  tooltip={isActive && !menuOpen ? 'Rename, duplicate or delete' : undefined}
                  onClick={() => pressedActive.current && setMenuOpen(true)}
                >
                  {label || `View ${i + 1}`}
                </Tab>
              </span>
            );
          })}
        </TabList>
      </Tabs>
      <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={onAdd}>
        Add view
      </Button>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        {menuOpen && (
          <ViewMenu
            key={active}
            anchor={anchor}
            label={labels[active] ?? ''}
            taken={labels.filter((_, i) => i !== active)}
            single={labels.length === 1}
            onRename={label => onRename(active, label)}
            onDuplicate={() => {
              setMenuOpen(false);
              onDuplicate(active);
            }}
            onDelete={() => {
              setMenuOpen(false);
              onDelete(active);
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </Popover>
    </div>
  );
}

type ViewMenuProps = {
  anchor: React.RefObject<HTMLSpanElement | null>;
  label: string;
  /** Labels of the other views; a view's label is unique. */
  taken: string[];
  single: boolean;
  onRename: (label: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
};

/** The name saves as you type when it's valid; an invalid name is shown and never saved. */
function ViewMenu({ anchor, label, taken, single, onRename, onDuplicate, onDelete, onClose }: ViewMenuProps) {
  const [name, setName] = useState(label);
  const trimmed = name.trim();
  const error = !trimmed
    ? 'Give the view a name.'
    : taken.includes(trimmed)
      ? 'Another view has this name.'
      : undefined;

  return (
    <PopoverContent anchor={anchor} align="start" className="flex w-60 flex-col gap-1 p-1.5">
      <form
        onSubmit={event => {
          event.preventDefault();
          event.stopPropagation();
          if (!error) onClose();
        }}
      >
        <Field invalid={!!error}>
          <Input
            size="sm"
            autoFocus
            aria-label="View name"
            value={name}
            onFocus={event => event.currentTarget.select()}
            onChange={event => {
              setName(event.target.value);
              const next = event.target.value.trim();
              if (next && !taken.includes(next)) onRename(next);
            }}
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
      </form>
      <div className="my-1 border-t border-border" />
      <Button size="sm" variant="ghost" icon={<CopyIcon />} className="w-full justify-start" onClick={onDuplicate}>
        Duplicate
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={<Trash2Icon />}
        className="w-full justify-start"
        disabled={single}
        onClick={onDelete}
      >
        Delete
      </Button>
      {single && (
        <Txt variant="caption" tone="muted" className="px-2 pb-1">
          A widget keeps at least one view.
        </Txt>
      )}
    </PopoverContent>
  );
}
