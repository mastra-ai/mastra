import type { TimelineSpan } from './build-thread-timeline';

/**
 * Studio route for the entity a step ran against, when that entity has an addressable page.
 *
 * Only kinds whose identifier is enough to build a real route are linked: a workflow step is not
 * routable on its own, and a model generation or workspace action has no entity page at all.
 */
export function spanEntityLink(span: TimelineSpan): string | undefined {
  const id = span.entityId;
  if (!id) return undefined;
  const encoded = encodeURIComponent(id);

  switch (span.spanType) {
    case 'agent_run':
      return `/agents/${encoded}`;
    case 'tool_call':
    case 'client_tool_call':
    case 'provider_tool_call':
      return `/tools/${encoded}`;
    case 'processor_run':
      return `/processors/${encoded}`;
    case 'workflow_run':
      return `/workflows/${encoded}`;
    case 'mcp_tool_call': {
      // An MCP tool only exists under its server, so both halves are required.
      const server = (span.attributes as { mcpServer?: unknown } | undefined)?.mcpServer;
      if (typeof server !== 'string' || !server) return undefined;
      return `/mcps/${encodeURIComponent(server)}/tools/${encoded}`;
    }
    default:
      return undefined;
  }
}
