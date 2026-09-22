import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import type { FactoryProject } from '../../workspaces/services/github';

interface FactoryPageProps {
  /** Renders the page body once a server-backed factory is active. */
  children: (factory: FactoryProject) => ReactNode;
}

/**
 * Resolves the route's factory for the Factory pages (Overview, Board, Rules,
 * Audit…). Any server-backed Factory renders its page — including one with
 * zero linked repositories (the pages show connect prompts). The app chrome
 * lives in `FactoryAppFrame`; pages own their `PageLayout`.
 */
export function FactoryPage({ children }: FactoryPageProps) {
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
  if (!factory) {
    return (
      <div className="p-4">
        <Notice variant="destructive">Factory not found.</Notice>
      </div>
    );
  }

  return children(factory);
}
