import { describe, expect, it } from 'vitest';
import { getTraceFilterGroups } from '../traces/trace-filters';
import { buildTraceQueryRequest } from '../traces/trace-query-filters';
import { buildTracesDrilldownUrl } from './drilldown';

/** The `where` the Traces page sends for a drilldown URL, read with the page's own parsers. */
function tracesWhere(url: string) {
  const params = new URL(url, 'http://studio').searchParams;
  return buildTraceQueryRequest({ tokens: [], groups: getTraceFilterGroups(params), now: new Date() }).where;
}

describe('buildTracesDrilldownUrl with a span scope', () => {
  describe('when a row stands for one span type', () => {
    it('opens traces with a span of that type for the entity, nested or not', () => {
      const url = buildTracesDrilldownUrl({
        preset: '7d',
        dashboardFilter: {},
        scope: { span: { spanTypes: ['agent_run'], entityName: 'Explore Subagent' } },
      });
      expect(tracesWhere(url)).toEqual({
        op: 'and',
        args: [
          {
            spans: {
              some: {
                op: 'and',
                args: [
                  { op: 'eq', left: { path: 'spanType' }, right: { literal: 'agent_run' } },
                  { op: 'eq', left: { path: 'entityName' }, right: { literal: 'Explore Subagent' } },
                ],
              },
            },
          },
        ],
      });
    });
  });

  describe('when a row stands for several span types and its failures', () => {
    it('matches any of the types on the same span that failed', () => {
      const url = buildTracesDrilldownUrl({
        preset: '7d',
        dashboardFilter: {},
        scope: { span: { spanTypes: ['tool_call', 'mcp_tool_call'], entityName: 'search', status: 'error' } },
      });
      expect(tracesWhere(url)).toEqual({
        op: 'and',
        args: [
          {
            spans: {
              some: {
                op: 'and',
                args: [
                  { op: 'in', value: { path: 'spanType' }, set: ['tool_call', 'mcp_tool_call'] },
                  { op: 'eq', left: { path: 'entityName' }, right: { literal: 'search' } },
                  { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
                ],
              },
            },
          },
        ],
      });
    });
  });

  describe('when the scope has no span', () => {
    it('adds no span filter', () => {
      const url = buildTracesDrilldownUrl({ preset: '7d', dashboardFilter: {}, scope: { entityName: 'x' } });
      expect(new URL(url, 'http://studio').searchParams.has('filterGroup')).toBe(false);
    });
  });
});
