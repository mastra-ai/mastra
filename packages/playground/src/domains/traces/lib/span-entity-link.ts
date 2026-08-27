import type { TimelineSpan } from './build-thread-timeline';

/**
 * Studio route for the entity a step ran against, when that entity has an addressable page.
 *
 * Only kinds whose identifier is enough to build a real route are linked: a workflow step is not
 * routable on its own, and a model generation or workspace action has no entity page at all.
 *
 * Calls that open in place — tools, workflows, processors — are deliberately left out: the row
 * already shows what they were given and what they returned, which is what the reader wants there.
 */
export function spanEntityLink(span: TimelineSpan): string | undefined {
  const id = span.entityId;
  if (!id) return undefined;
  const encoded = encodeURIComponent(id);

  switch (span.spanType) {
    case 'agent_run':
      return `/agents/${encoded}`;
    default:
      return undefined;
  }
}
