import { describe, expect, it } from 'vitest';
import type { BreakdownRow } from './breakdown';
import { previousFigures } from './breakdown';
import {
  changeDescription,
  drilldownFor,
  formatChange,
  formatCost,
  previousScope,
  rowLabel,
  showsProject,
  tableRows,
  countDescription,
  volumeLabel,
} from './breakdown-table';

const row = (figures: Partial<BreakdownRow>): BreakdownRow => ({
  key: 'a',
  name: 'a',
  count: 1,
  ...figures,
});

describe('volumeLabel', () => {
  describe('when Change follows the count column', () => {
    it('counts traces, or spans where one trace makes many', () => {
      expect(volumeLabel('agents')).toBe('Traces');
      expect(volumeLabel('workflows')).toBe('Traces');
      expect(volumeLabel('environments')).toBe('Traces');
      expect(volumeLabel('tools')).toBe('Spans');
      expect(countDescription('agents')).toMatch(/^A trace is/);
      expect(countDescription('models')).toMatch(/^A span is/);
      expect(volumeLabel('models')).toBe('Spans');
    });
  });
});

describe('tableRows', () => {
  const previous = previousFigures({
    tab: 'environments',
    groupBy: ['threadId'],
    aggregateRows: [{ dimensions: { threadId: 'gone' }, measures: { count: 4 } }],
  });
  const base = { previous, truncated: false, groupBy: ['threadId'], usage: true };

  describe('when the tab lists threads', () => {
    it('drops traces without a thread and doesn’t list threads that ended', () => {
      const built = [row({ key: '', name: '' }), row({ key: 't1', name: 't1' })];
      expect(tableRows({ ...base, tab: 'threads', built }).map(r => r.key)).toEqual(['t1']);
    });
  });

  describe('when the server truncated the list', () => {
    it('lists no dropped rows, since a missing row may only be past the cap', () => {
      const built = [row({ key: 'kept' })];
      expect(tableRows({ ...base, tab: 'environments', built, truncated: true }).map(r => r.key)).toEqual(['kept']);
      expect(tableRows({ ...base, tab: 'environments', built }).map(r => r.key)).toEqual(['kept', 'gone']);
    });
  });
});

describe('rowLabel', () => {
  describe('when a row has no name', () => {
    it('names what is missing', () => {
      expect(rowLabel('environments', row({ name: '' }))).toBe('No environment');
      expect(rowLabel('models', row({ name: '' }))).toBe('Unknown model');
    });
  });

  describe('when the row is a project', () => {
    it('uses the page’s project name', () => {
      expect(rowLabel('projects', row({ key: 'p1' }), id => `Project ${id}`)).toBe('Project p1');
    });
  });
});

describe('drilldownFor', () => {
  describe('when an org-wide entity row opens', () => {
    it('opens its runs in its project', () => {
      expect(drilldownFor('tools', row({ name: 'search', projectId: 'p1' }))).toEqual({
        projectId: 'p1',
        span: { spanTypes: ['tool_call', 'mcp_tool_call'], entityName: 'search' },
      });
    });
  });
});

describe('drilldownFor at org scope', () => {
  describe('when a thread or model row opens', () => {
    it('opens it in its project', () => {
      expect(drilldownFor('threads', row({ name: 't1', projectId: 'p1' }))).toEqual({
        projectId: 'p1',
        threadId: 't1',
      });
      expect(drilldownFor('models', row({ name: 'gpt-5-mini', projectId: 'p1' }))).toEqual({
        projectId: 'p1',
        model: 'gpt-5-mini',
      });
    });
  });
});

describe('showsProject', () => {
  describe('when the page covers one project', () => {
    it('has no Project column', () => {
      expect(showsProject('agents', false)).toBe(false);
    });
  });

  describe('when the page spans an organization', () => {
    it('has one on every tab but Projects, whose rows are the projects', () => {
      expect(showsProject('agents', true)).toBe(true);
      expect(showsProject('projects', true)).toBe(false);
    });
  });
});

describe('changeDescription', () => {
  describe('when the range is the last 7 days', () => {
    it('names the figure it compares, and both ranges by their dates', () => {
      const window = { start: new Date(2026, 9, 19, 12), end: new Date(2026, 9, 26, 12) };
      const { summary, current, previous } = changeDescription(window, 'P95 latency');
      expect(summary).toMatch(/^Change in p95 latency from the previous range of the same length\./);
      expect(current).toBe('Selected: Oct 19, 12:00 PM – Oct 26, 12:00 PM');
      expect(previous).toBe('Previous: Oct 12, 12:00 PM – Oct 19, 12:00 PM');
    });
  });
});

describe('formatChange', () => {
  describe('when the error rate moved', () => {
    it('gives points, and under 0.05 points says so instead of +0.0', () => {
      expect(formatChange({ delta: 0.012, change: 0.012, isNew: false }, 'errorRate')).toBe('+1.2 pt');
      expect(formatChange({ delta: 0.0002, change: 0.0002, isNew: false }, 'errorRate')).toBe('+<0.1 pt');
    });
  });

  describe('when there was nothing before', () => {
    it('says New, or a dash when there is nothing to compare', () => {
      expect(formatChange({ isNew: true }, 'count')).toBe('New');
      expect(formatChange({ isNew: false }, 'p95')).toBe('—');
    });
  });
});

describe('formatCost', () => {
  describe('when a store reports the unit in lower case', () => {
    it('still formats dollars', () => {
      expect(formatCost(7.25, 'usd')).toBe(formatCost(7.25, 'USD'));
      expect(formatCost(7.25, 'usd')).toMatch(/^\$7\.2/);
    });
  });
});

describe('previousScope', () => {
  describe('when a tab compares with the previous window', () => {
    it('moves its window and time range back by one window length', () => {
      const scope = { window: { start: new Date('2026-10-02T00:00:00Z'), end: new Date('2026-10-03T00:00:00Z') } };
      expect(previousScope(scope)).toMatchObject({
        window: { start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-10-02T00:00:00Z') },
        timeRange: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' },
      });
    });
  });
});
