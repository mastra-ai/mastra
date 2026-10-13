import { Button } from '@mastra/playground-ui/components/Button';
import { Card } from '@mastra/playground-ui/components/Card';
import {
  DialogAction,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { FileDropBackdrop } from '@mastra/playground-ui/components/FileDropBackdrop';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, FileSpreadsheet, PenLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId } from 'react';

export interface AddItemsStepProps {
  onAddManually: () => void;
  onImportCsv: (file?: File) => void;
  onBack: () => void;
  /** Creates the dataset without items. */
  onCreate: () => void;
  pending: boolean;
}

export function AddItemsStep({ onAddManually, onImportCsv, onBack, onCreate, pending }: AddItemsStepProps) {
  return (
    <FileDropBackdrop
      disabled={pending}
      accept=".csv,text/csv"
      label="Drop CSV to import"
      description="The file opens in the CSV import"
      onFilesDrop={([file]) => onImportCsv(file)}
    >
      <DialogHeader>
        <DialogTitle>Add items</DialogTitle>
        <DialogDescription>Add the first items now, or create the dataset empty and add them later.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <ItemsChoice
            icon={<PenLine />}
            title="Add items manually"
            description="Write the input and ground truth of each item as JSON."
            onClick={onAddManually}
          />
          <OrDivider />
          <ItemsChoice
            icon={<FileSpreadsheet />}
            title="Import from CSV"
            description="Upload a file, or drop it anywhere on this window."
            onClick={() => onImportCsv()}
            className="[animation-delay:75ms]"
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onBack} disabled={pending}>
          Back
        </Button>
        <DialogAction onConfirm={onCreate}>{pending ? 'Creating...' : 'Create dataset'}</DialogAction>
      </DialogFooter>
    </FileDropBackdrop>
  );
}

interface ItemsChoiceProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  className?: string;
}

function ItemsChoice({ icon, title, description, onClick, className }: ItemsChoiceProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Card
      interactive
      onClick={onClick}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        'group flex flex-col items-start gap-3 bg-field p-4 text-left hover:bg-field active:bg-field',
        'animate-in fade-in-0 fill-mode-both [--tw-animation-duration:var(--duration-slow)] slide-in-from-bottom-2 motion-reduce:animate-none',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-lg bg-field text-foreground shadow-raised transition-transform duration-normal ease-out-custom group-hover:-translate-y-0.5 group-hover:scale-105 motion-reduce:transition-none [&>svg]:size-5',
        )}
      >
        {icon}
      </span>
      <span className="flex w-full flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <Txt as="span" id={titleId} variant="card-title-strong" tone="ink">
            {title}
          </Txt>
          <ArrowRight
            aria-hidden
            className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-normal ease-out-custom group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
          />
        </span>
        <Txt as="span" id={descriptionId} variant="caption" tone="muted">
          {description}
        </Txt>
      </span>
    </Card>
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
