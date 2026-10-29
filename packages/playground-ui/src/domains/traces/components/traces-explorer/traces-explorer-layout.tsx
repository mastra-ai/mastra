import type { ReactNode } from 'react';
import { TracesExplorerBody } from './traces-explorer-body';
import type { TracesExplorerBodyProps } from './traces-explorer-body';
import { useTracesBodyLoading } from './use-traces-discovery';
import { PageLayout } from '@/ds/components/PageLayout';

export type { TracesExplorerErrorRenderArgs } from './traces-explorer-body';

export type TracesExplorerLayoutProps = TracesExplorerBodyProps & {
  breadcrumbs?: ReactNode;
  /** Navigation pinned under the header (e.g. view tabs). Unlike `actionRow`, it stays up while filter fields load. */
  tabs?: ReactNode;
  /** Controls pinned under the header, hidden while filter fields load. */
  actionRow?: ReactNode;
};

/** The traces page: `TracesExplorer.Body` inside a page frame with breadcrumbs and pinned controls. */
export function TracesExplorerLayout({
  breadcrumbs,
  tabs,
  actionRow,
  toolbar,
  chart,
  children,
  renderError,
}: TracesExplorerLayoutProps) {
  const isBodyLoading = useTracesBodyLoading();

  // Like the toolbar, the action row waits for the body's loading skeleton to clear; the tabs do not.
  const visibleActionRow = isBodyLoading ? undefined : actionRow;
  const pinned =
    tabs || visibleActionRow ? (
      <>
        {tabs}
        {visibleActionRow}
      </>
    ) : undefined;

  return (
    <PageLayout breadcrumbs={breadcrumbs} actionRow={pinned}>
      <TracesExplorerBody toolbar={toolbar} chart={chart} renderError={renderError}>
        {children}
      </TracesExplorerBody>
    </PageLayout>
  );
}
