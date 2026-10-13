import { Button } from '@mastra/playground-ui/components/Button';
import { Card } from '@mastra/playground-ui/components/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, FileUp, PenLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId, useRef, useState } from 'react';

export type ImportFormat = 'csv' | 'json';

export interface AddItemsChoicesProps {
  onAddManually: () => void;
  /** CSV is called with the file picked from the native picker; JSON without one (it can also be pasted). */
  onImport: (format: ImportFormat, file?: File) => void;
  /** Extra line describing the import, e.g. that a file can be dropped. */
  importHint?: string;
  disabled?: boolean;
}

const cardClassName = cn(
  'flex flex-col items-start gap-3 bg-field p-4 text-left',
  'animate-in fade-in-0 fill-mode-both [--tw-animation-duration:var(--duration-slow)] slide-in-from-bottom-2 motion-reduce:animate-none',
);

const iconClassName =
  'flex size-10 items-center justify-center rounded-lg bg-field text-foreground shadow-raised transition-transform duration-normal ease-out-custom motion-reduce:transition-none [&>svg]:size-5';

/** The two ways to add items to a dataset: write them by hand, or import a CSV / JSON file. */
export function AddItemsChoices({ onAddManually, onImport, importHint, disabled }: AddItemsChoicesProps) {
  // A disabled fieldset disables every control inside, including the Card button, which has no `disabled` prop.
  return (
    <fieldset disabled={disabled} className="grid w-full min-w-0 gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <ManualChoice onClick={onAddManually} />
      <OrDivider />
      <ImportChoice onImport={onImport} hint={importHint} disabled={disabled} />
    </fieldset>
  );
}

function ManualChoice({ onClick }: { onClick: () => void }) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Card
      interactive
      onClick={onClick}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(cardClassName, 'group hover:bg-field active:bg-field')}
    >
      <span className={cn(iconClassName, 'group-hover:-translate-y-0.5 group-hover:scale-105')}>
        <PenLine />
      </span>
      <span className="flex w-full flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <ChoiceTitle id={titleId}>Add items manually</ChoiceTitle>
          <ArrowRight
            aria-hidden
            className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-normal ease-out-custom group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
          />
        </span>
        <ChoiceDescription id={descriptionId}>Write the input and ground truth of each item as JSON.</ChoiceDescription>
      </span>
    </Card>
  );
}

function ImportChoice({
  onImport,
  hint,
  disabled,
}: {
  onImport: (format: ImportFormat, file?: File) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const [format, setFormat] = useState<ImportFormat>('csv');
  const csvInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const handleImportClick = () => {
    if (format === 'csv') {
      csvInputRef.current?.click();
    } else {
      onImport('json');
    }
  };

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be picked again.
    e.target.value = '';
    if (file) onImport('csv', file);
  };

  // Not a button itself: it holds the format select and its own Import action.
  return (
    <Card
      role="group"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(cardClassName, '[animation-delay:75ms]')}
    >
      <span className={iconClassName}>
        <FileUp />
      </span>
      <div className="flex w-full flex-col gap-1">
        <ChoiceTitle id={titleId}>Import from a file</ChoiceTitle>
        <ChoiceDescription id={descriptionId}>
          Bring items from a CSV or JSON file.{hint && ` ${hint}`}
        </ChoiceDescription>
      </div>
      <div className="mt-auto flex items-center gap-2">
        <Select value={format} onValueChange={value => setFormat(value as ImportFormat)} disabled={disabled}>
          <SelectTrigger size="sm" aria-label="File format" className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleImportClick} disabled={disabled}>
          Import
        </Button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          onChange={handleCsvChange}
          disabled={disabled}
          hidden
        />
      </div>
    </Card>
  );
}

function ChoiceTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Txt as="span" id={id} variant="card-title-strong" tone="ink">
      {children}
    </Txt>
  );
}

function ChoiceDescription({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Txt as="span" id={id} variant="caption" tone="muted">
      {children}
    </Txt>
  );
}

function OrDivider() {
  return (
    <div aria-hidden className="flex items-center gap-2 sm:flex-col">
      <span className="h-px flex-1 bg-border sm:h-auto sm:w-px" />
      <Txt as="span" variant="eyebrow" tone="faint">
        or
      </Txt>
      <span className="h-px flex-1 bg-border sm:h-auto sm:w-px" />
    </div>
  );
}
