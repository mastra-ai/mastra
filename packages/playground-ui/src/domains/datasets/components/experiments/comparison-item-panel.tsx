'use client';

import type { CompareExperimentsResponse } from '@mastra/client-js';
import { AlertTriangleIcon, FileCodeIcon, FileInputIcon, FileOutputIcon, TargetIcon, XIcon } from 'lucide-react';
import { Column } from '@/ds/components/Columns';
import { PrevNextNav } from '@/ds/components/PrevNextNav';
import { MainHeader } from '@/ds/components/MainHeader';
import { SideDialog } from '@/ds/components/SideDialog';
import { Sections } from '@/ds/components/Sections';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Notice } from '@/ds/components/Notice';
import { ScoreDelta } from './score-delta';
import { Chip } from '@/ds/components/Chip';

type ComparisonItem = CompareExperimentsResponse['items'][number];

export interface ComparisonItemPanelProps {
  item: ComparisonItem;
  baselineId: string;
  contenderId: string;
  baselineVersion?: number | null;
  contenderVersion?: number | null;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export function ComparisonItemPanel({
  item,
  baselineId,
  contenderId,
  baselineVersion,
  contenderVersion,
  onPrevious,
  onNext,
  onClose,
}: ComparisonItemPanelProps) {
  const baselineResult = item.results[baselineId];
  const contenderResult = item.results[contenderId];
  const inBoth = Boolean(baselineResult && contenderResult);

  const scorerIds = new Set<string>();
  if (baselineResult) for (const key of Object.keys(baselineResult.scores)) scorerIds.add(key);
  if (contenderResult) for (const key of Object.keys(contenderResult.scores)) scorerIds.add(key);
  const sortedScorerIds = [...scorerIds].sort();

  return (
    <Column withLeftSeparator={true}>
      <Column.Toolbar>
        <PrevNextNav
          onPrevious={onPrevious}
          onNext={onNext}
          previousAriaLabel="Previous comparison item"
          nextAriaLabel="Next comparison item"
        />
        <ButtonsGroup>
          <Button variant="standard" size="default" onClick={onClose} aria-label="Close comparison detail panel">
            <XIcon />
          </Button>
        </ButtonsGroup>
      </Column.Toolbar>

      <Column.Content className="pb-6">
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title size="smaller">
              <FileCodeIcon /> {item.itemId}
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>

        {!inBoth ? (
          <Notice variant="warning">
            <AlertTriangleIcon />
            <Notice.Message>
              {(() => {
                const missingIn = baselineResult ? 'Contender' : 'Baseline';
                const version = baselineResult ? contenderVersion : baselineVersion;
                return (
                  <>
                    The {missingIn} experiment was run against dataset{version != null ? ` v. ${version}` : ''}, which
                    does not contain this item. Comparison is not available.
                  </>
                );
              })()}
            </Notice.Message>
          </Notice>
        ) : (
          <>
            <Sections>
              {sortedScorerIds.length > 0 && (
                <div className="grid gap-3">
                  <h4 className="text-sm font-medium text-neutral5">Scores</h4>
                  <div className="grid gap-2">
                    {sortedScorerIds.map(scorerId => {
                      const baselineScore = baselineResult?.scores[scorerId] ?? null;
                      const contenderScore = contenderResult?.scores[scorerId] ?? null;
                      const delta =
                        baselineScore != null && contenderScore != null ? contenderScore - baselineScore : null;

                      return (
                        <div
                          key={scorerId}
                          className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg bg-surface2"
                        >
                          <span className="text-sm text-neutral5 font-medium">{scorerId}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-neutral3">
                              {baselineScore != null ? baselineScore.toFixed(3) : '-'} →{' '}
                              {contenderScore != null ? contenderScore.toFixed(3) : '-'}
                            </span>
                            {delta != null && <ScoreDelta delta={delta} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <SideDialog.CodeSection
                title={
                  <>
                    <Chip color="purple">Baseline </Chip> Experiment Output
                  </>
                }
                icon={<FileOutputIcon />}
                codeStr={formatValue(baselineResult?.output)}
              />
              <SideDialog.CodeSection
                title={
                  <>
                    <Chip color="cyan">Contender </Chip> Experiment Output
                  </>
                }
                icon={<FileOutputIcon />}
                codeStr={formatValue(contenderResult?.output)}
              />
              <SideDialog.CodeSection title="Item Input" icon={<FileInputIcon />} codeStr={formatValue(item.input)} />
              <SideDialog.CodeSection
                title="Item Ground Truth"
                icon={<TargetIcon />}
                codeStr={formatValue(item.groundTruth)}
              />
            </Sections>
          </>
        )}
      </Column.Content>
    </Column>
  );
}
