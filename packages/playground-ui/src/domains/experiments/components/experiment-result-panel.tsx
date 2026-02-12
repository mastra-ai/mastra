'use client';

import { DatasetExperimentResult } from '@mastra/client-js';
import { Section } from '@/ds/components/Section';
import { TextAndIcon, getShortId } from '@/ds/components/Text';
import { CopyButton } from '@/ds/components/CopyButton';
import { FileOutputIcon, AlertCircleIcon, Calendar1Icon, PlayIcon, FileCodeIcon, PanelRightIcon } from 'lucide-react';
import { format } from 'date-fns/format';
import { SideDialog } from '@/ds/components/SideDialog';
import { ListAndDetails } from '@/ds/components/ListAndDetails';
import { MainHeader } from '@/ds/components/MainHeader';
import { Button, ButtonsGroup } from '@/index';

export type ExperimentResultPanelProps = {
  result: DatasetExperimentResult;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onShowTrace?: () => void;
};

export function ExperimentResultPanel({
  result,
  onPrevious,
  onNext,
  onClose,
  onShowTrace,
}: ExperimentResultPanelProps) {
  const hasError = Boolean(result.error);
  const outputStr = formatValue(result.output);

  return (
    <>
      <ListAndDetails.ColumnToolbar>
        <ListAndDetails.NextPrevNavigation
          onPrevious={onPrevious}
          onNext={onNext}
          previousAriaLabel="View previous result details"
          nextAriaLabel="View next result details"
        />
        <ButtonsGroup>
          <Button variant="standard" size="default" onClick={onShowTrace} disabled={!result.traceId}>
            <PanelRightIcon />
            Show Trace
          </Button>
          <ListAndDetails.CloseButton onClick={onClose} aria-label="Close result details panel" />
        </ButtonsGroup>
      </ListAndDetails.ColumnToolbar>

      <ListAndDetails.ColumnContent>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title size="smaller">
              <PlayIcon /> {result.id}
            </MainHeader.Title>
            <MainHeader.Description>
              <TextAndIcon>
                <FileCodeIcon /> {result.itemId}
              </TextAndIcon>
            </MainHeader.Description>
          </MainHeader.Column>
        </MainHeader>

        <SideDialog.CodeSection title="Input" icon={<FileOutputIcon />} codeStr={outputStr} />

        <div className="grid gap-2">
          <h4 className="text-sm font-medium text-neutral5 flex items-center gap-2">
            <Calendar1Icon className="w-4 h-4" /> Created
          </h4>
          <p className="text-sm text-neutral4">{format(new Date(result.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
        </div>

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
      </ListAndDetails.ColumnContent>
    </>
  );
}

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
