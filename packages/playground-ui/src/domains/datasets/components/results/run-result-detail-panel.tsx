'use client';

import { DatasetRunResult } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { Section } from '@/ds/components/Section';
import { TextAndIcon, getShortId } from '@/ds/components/Text';
import { CopyButton } from '@/ds/components/CopyButton';
import {
  HashIcon,
  FileOutputIcon,
  ClockIcon,
  AlertCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XIcon,
  Calendar1Icon,
} from 'lucide-react';
import { format } from 'date-fns/format';
import { SideDialog } from '@/ds/components/SideDialog';

export type RunResultDetailPanelProps = {
  result: DatasetRunResult;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
};

/**
 * Side panel showing full details of a single run result.
 * Includes navigation to next/previous results and sections for Output, Latency, and Error.
 */
export function RunResultDetailPanel({ result, onPrevious, onNext, onClose }: RunResultDetailPanelProps) {
  const hasError = Boolean(result.error);
  const outputStr = formatValue(result.output);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full gap-9">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Left side: Navigation */}
        <div className="flex items-center gap-[2px]">
          <Button
            variant="secondary"
            size="default"
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label="Previous result"
            hasRightSibling={true}
          >
            <ArrowUpIcon /> Previous
          </Button>
          <Button
            variant="secondary"
            hasLeftSibling={true}
            size="default"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next result"
          >
            Next <ArrowDownIcon />
          </Button>
        </div>

        {/* Right side: Close */}
        <Button variant="secondary" size="default" onClick={onClose} aria-label="Close detail panel">
          <XIcon />
        </Button>
      </div>

      {/* Content */}
      <div className="grid overflow-y-auto gap-8 content-start">
        {/* Header */}
        <div className="grid gap-2">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <FileOutputIcon className="w-5 h-5" /> Result
          </h2>
          <div className="flex items-center gap-4 text-sm text-neutral4">
            <TextAndIcon>
              <HashIcon /> {getShortId(result.id)}
            </TextAndIcon>
            <TextAndIcon>
              <HashIcon /> Item: {result.itemId}
            </TextAndIcon>
          </div>
        </div>

        {/* Output Section */}
        <SideDialog.CodeSection title="Input" icon={<FileOutputIcon />} codeStr={outputStr} />
        {/* <Section>
          <Section.Header>
            <Section.Heading>
              <FileOutputIcon /> Output
            </Section.Heading>
            <CopyButton content={outputStr} />
          </Section.Header>
          <div className="bg-black/20 p-4 overflow-hidden rounded-xl border border-white/10 text-neutral4 text-ui-md">
            <pre className="text-wrap font-mono text-sm whitespace-pre-wrap break-all">{outputStr}</pre>
          </div>
        </Section> */}

        {/* Latency */}
        <div className="grid gap-2">
          <h4 className="text-sm font-medium text-neutral5 flex items-center gap-2">
            <ClockIcon className="w-4 h-4" /> Latency
          </h4>
          <p className="text-sm text-neutral4">{Math.floor(result.latency)}ms</p>
        </div>

        {/* Created */}
        <div className="grid gap-2">
          <h4 className="text-sm font-medium text-neutral5 flex items-center gap-2">
            <Calendar1Icon className="w-4 h-4" /> Created
          </h4>
          <p className="text-sm text-neutral4">{format(new Date(result.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
        </div>

        {/* Error Section (if present) */}
        {hasError && (
          <Section>
            <Section.Header>
              <Section.Heading>
                <AlertCircleIcon /> Error
              </Section.Heading>
              <CopyButton content={result.error || ''} />
            </Section.Header>
            <div className="bg-black/20 p-4 overflow-hidden rounded-xl border border-white/10 text-neutral4 text-ui-md">
              <pre className="text-wrap font-mono text-sm whitespace-pre-wrap break-all">{result.error}</pre>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
