'use client';

import { DatasetExperimentResult } from '@mastra/client-js';
import { TextAndIcon } from '@/ds/components/Text';
import { FileOutputIcon, Calendar1Icon, PlayIcon, FileCodeIcon, PanelRightIcon, OctagonAlertIcon } from 'lucide-react';
import { format } from 'date-fns/format';
import { SideDialog } from '@/ds/components/SideDialog';
import { ListAndDetails } from '@/ds/components/ListAndDetails';
import { MainHeader } from '@/ds/components/MainHeader';
import { Button, ButtonsGroup, Notice } from '@/index';

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
  const hasError = Boolean(result?.error);
  const inputStr = formatValue(result?.input);
  const outputStr = formatValue(result?.output);

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

        {hasError && (
          <Notice variant="destructive">
            <OctagonAlertIcon />
            <Notice.Message>
              <strong>Error: </strong>
              {formatValue(
                result?.error && typeof result.error === 'object'
                  ? (result.error as Record<string, unknown>).message
                  : result?.error,
              )}
            </Notice.Message>
          </Notice>
        )}

        <SideDialog.CodeSection title="Input" icon={<FileCodeIcon />} codeStr={inputStr} />
        <SideDialog.CodeSection title="Output" icon={<FileOutputIcon />} codeStr={outputStr} />

        <div className="grid gap-2">
          <h4 className="text-sm font-medium text-neutral5 flex items-center gap-2">
            <Calendar1Icon className="w-4 h-4" /> Created
          </h4>
          <p className="text-sm text-neutral4">{format(new Date(result.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
        </div>
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
