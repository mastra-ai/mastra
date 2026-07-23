import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../../shared/hooks/useFactories';
import { Sidebar } from '../../../Sidebar';
import { DocumentPageLayout, ViewportPageLayout } from '../../../ui/PageLayout';
import { ChatHeader } from '../../chat/components/ChatHeader';
import type { FactoryProject } from '../../workspaces/services/github';

interface FactoryPageShellProps {
  /** Renders the page body once a server-backed factory is active. */
  children: (factory: FactoryProject) => ReactNode;
}

/**
 * Shared frame for the Factory pages (Board, Metrics, Rules, Audit): the standard
 * app layout (sidebar + mobile header) around a titled content column. Any
 * server-backed Factory renders its pages — including one with zero linked
 * repositories (the pages show connect prompts). Local folder factories get an
 * explanatory notice; when a factory links multiple repositories a picker in
 * the header scopes repository-based intake.
 */
function FactoryPageShellFrame({
  children,
  Layout,
}: FactoryPageShellProps & {
  Layout: typeof DocumentPageLayout;
}) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);

  if (factoryQuery.isPending) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const factory = factoryQuery.data;

  return (
    <Layout sidebar={<Sidebar />} header={<ChatHeader />}>
      {factory ? children(factory) : <Notice variant="destructive">Factory not found.</Notice>}
    </Layout>
  );
}

/** Factory page whose content participates in native document scrolling. */
export function DocumentFactoryPageShell(props: FactoryPageShellProps) {
  return <FactoryPageShellFrame {...props} Layout={DocumentPageLayout} />;
}

/** Factory page with nested scroll regions constrained to the viewport. */
export function FactoryPageShell({ children }: FactoryPageShellProps) {
  return (
    <FactoryPageShellFrame Layout={ViewportPageLayout}>
      {factory => <div className="flex min-h-0 flex-1 flex-col p-5">{children(factory)}</div>}
    </FactoryPageShellFrame>
  );
}
