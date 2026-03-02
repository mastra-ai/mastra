'use client';

import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { TextAndIcon } from '@/ds/components/Text';
import {
  FileOutputIcon,
  Calendar1Icon,
  PlayIcon,
  FileCodeIcon,
  PanelRightIcon,
  OctagonAlertIcon,
  XIcon,
} from 'lucide-react';
import { format } from 'date-fns/format';
import { SideDialog } from '@/ds/components/SideDialog';
import { Column } from '@/ds/components/Columns/column';
import { PrevNextNav } from '@/ds/components/PrevNextNav';
import { ItemList } from '@/ds/components/ItemList';
import { MainHeader } from '@/ds/components/MainHeader';
import { Button, ButtonsGroup, Notice } from '@/index';

const scoreColumns = [
  { name: 'scorer', label: 'Scorer', size: '1fr' },
  { name: 'score', label: 'Score', size: '1fr' },
];

export type ExperimentResultPanelProps = {
  result: DatasetExperimentResult;
  scores?: ClientScoreRowData[];
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onShowTrace?: () => void;
  onScoreClick?: (scoreId: string) => void;
  featuredScoreId?: string | null;
};

export function ExperimentResultPanel({
  result,
  scores,
  onPrevious,
  onNext,
  onClose,
  onShowTrace,
  onScoreClick,
  featuredScoreId,
}: ExperimentResultPanelProps) {
  const hasError = Boolean(result?.error);
  const inputStr = formatValue(result?.input);
  const outputStr = formatValue(result?.output);

  return (
    <>
      <Column.Toolbar>
        <PrevNextNav
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
          <Button variant="standard" size="default" onClick={onClose} aria-label="Close result details panel">
            <XIcon />
          </Button>
        </ButtonsGroup>
      </Column.Toolbar>

      <Column.Content>
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

        {scores && scores.length > 0 && (
          <ItemList className="grid-rows-[auto_auto] overflow-visible">
            <ItemList.Header columns={scoreColumns}>
              <ItemList.HeaderCol>Scorer</ItemList.HeaderCol>
              <ItemList.HeaderCol>Score</ItemList.HeaderCol>
            </ItemList.Header>
            <ItemList.Items>
              {scores.map(score => (
                <ItemList.Row key={score.id}>
                  <ItemList.RowButton
                    item={{ id: score.id }}
                    columns={scoreColumns}
                    isFeatured={featuredScoreId === score.id}
                    onClick={onScoreClick}
                  >
                    <ItemList.TextCell>{score.scorerId}</ItemList.TextCell>
                    <ItemList.TextCell className="font-mono">{score.score.toFixed(3)}</ItemList.TextCell>
                  </ItemList.RowButton>
                </ItemList.Row>
              ))}
            </ItemList.Items>
          </ItemList>
        )}

        <SideDialog.CodeSection title="Input" icon={<FileCodeIcon />} codeStr={inputStr} />
        <SideDialog.CodeSection title="Output" icon={<FileOutputIcon />} codeStr={outputStr} />

        <div className="grid gap-2">
          <h4 className="text-sm font-medium text-neutral5 flex items-center gap-2">
            <Calendar1Icon className="w-4 h-4" /> Created
          </h4>
          <p className="text-sm text-neutral4">{format(new Date(result.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
        </div>
      </Column.Content>
    </>
  );
}

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
