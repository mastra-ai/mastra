import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { applyTheme, readResult } from '../../shared/mcp-app';
import { isLightTrace, OpenedTrace } from '../../shared/trace-view';
import type { LightTrace } from '../../shared/trace-view';

/**
 * Draws the trace that the built-in server's `get_trace` tool returned, with Studio's timeline, and
 * loads a span's details through `get_span` when the user picks one. Both calls go back through the
 * host's MCP connection, so they run with the caller's own permissions.
 */
export function TraceViewer() {
  const [trace, setTrace] = useState<LightTrace>();
  const [problem, setProblem] = useState<string>();
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  const { app, error } = useApp({
    appInfo: { name: 'Mastra trace viewer', version: __PACKAGE_VERSION__ },
    capabilities: {},
    onAppCreated: app => {
      app.ontoolresult = result => {
        const value = readResult(result);
        if (isLightTrace(value)) setTrace(value);
        else setProblem(result.isError ? 'The trace could not be loaded.' : 'The tool returned no trace.');
      };
      app.onhostcontextchanged = context => applyTheme(context.theme);
    },
  });
  useEffect(() => applyTheme(app?.getHostContext()?.theme), [app]);

  const message = error?.message ?? problem;
  if (message) {
    return (
      <Txt variant="body-sm" tone="muted" className="p-4">
        {message}
      </Txt>
    );
  }
  if (!app || !trace) {
    return (
      <div className="flex min-h-25 items-center justify-center">
        <Spinner size="sm" aria-label="Loading the trace" />
      </div>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OpenedTrace app={app} trace={trace} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
