import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { McpAppProvider } from './mcp-app-context';
import type { McpAppSession } from './session';

export type McpAppViewProps<Input> = {
  session: McpAppSession<Input>;
  /** Shown while waiting for the tool result, e.g. "Loading dashboard". */
  loadingTitle: string;
  /** Shown above the reason when the tool result can't be rendered. */
  errorTitle: string;
  children: (input: Input) => ReactNode;
};

/**
 * Renders the waiting and failed states every MCP App shares, and `children` once the input is
 * ready, with the host connection available through `useMcpApp`.
 */
export function McpAppView<Input>({ session, loadingTitle, errorTitle, children }: McpAppViewProps<Input>) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);

  if (state.status === 'waiting') {
    return <EmptyState iconSlot={<Spinner />} titleSlot={loadingTitle} />;
  }

  if (state.status === 'failed') {
    return <EmptyState tone="error" titleSlot={errorTitle} descriptionSlot={state.message} />;
  }

  return <McpAppProvider value={session.app}>{children(state.input)}</McpAppProvider>;
}
