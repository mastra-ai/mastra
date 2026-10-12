import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';
import type { OverviewRange } from '../overview-period';
import { AttentionStrip } from './attention-strip';
import type { Regression } from './attention-strip';
import { PeriodControl } from './period-control';
import { PeriodTotals } from './period-totals';
import type { PeriodTotal } from './period-totals';

export interface OverviewPeriodSummary {
  range: OverviewRange;
  onRangeChange: (range: OverviewRange) => void;
  totals?: PeriodTotal[];
  regressions: Regression[];
}

export function OverviewPageLayout({
  title,
  breadcrumbs,
  headerLinks,
  search,
  onSearchChange,
  searchLabel,
  period,
  notice,
  children,
}: {
  title: string;
  breadcrumbs: ReactNode;
  headerLinks: ReactNode;
  search: string;
  onSearchChange: (search: string) => void;
  searchLabel: string;
  period?: OverviewPeriodSummary;
  notice?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageLayout
      variant="catalog"
      breadcrumbs={breadcrumbs}
      headerActions={
        <>
          {period && <PeriodControl range={period.range} onRangeChange={period.onRangeChange} />}
          {headerLinks}
        </>
      }
      header={
        (period?.totals || notice) && (
          <div className="@container flex flex-col gap-4">
            {notice}
            {period?.totals && <PeriodTotals totals={period.totals} range={period.range} />}
            {period && <AttentionStrip regressions={period.regressions} range={period.range} />}
          </div>
        )
      }
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <div className="max-w-120 flex-1">
              <ListSearch value={search} onSearch={onSearchChange} label={searchLabel} placeholder="Filter by name" />
            </div>
          </ActionRow.Start>
        </ActionRow>
      }
    >
      <h1 className="sr-only">{title}</h1>
      {children}
    </PageLayout>
  );
}
