import { describe, expect, it } from 'vitest';
import type { BreakdownRow } from './breakdown';
import { previousFigures } from './breakdown';
import {
  comparedLabel,
  drilldownFor,
  formatChange,
  formatCost,
  previousScope,
  rowLabel,
  tableRows,
  volumeLabel,
} from './breakdown-table';

const row = (figures: Partial<BreakdownRow>): BreakdownRow => ({
  key: 'a',
  name: 'a',
  count: 1,
  trend: [],
  ...figures,
});

describe('volumeLabel and comparedLabel', () => {
  describe('when Before and Change follow the volume column', () => {
    it('names it per tab', () => {
      expect(volumeLabel('tools')).toBe('Calls');
      expect(volumeLabel('agents')).toBe('Runs');
      expect(volumeLabel('environments')).toBe('Traces');
      expect(volumeLabel('models')).toBe('Tokens');
      expect(comparedLabel('tools', 'count')).toBe('Calls');
    });
  });

  describe('when they follow another column', () => {
    it('names that column', () => {
      expect(comparedLabel('agents', 'cost')).toBe('Cost');
      expect(comparedLabel('agents', 'errorRate')).toBe('Errors');
    });
  });
});

describe('tableRows', () => {
  const previous = previousFigures([{ dimensions: { threadId: 'gone' }, measures: { count: 4 } }], ['threadId'], []);
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
