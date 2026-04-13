import { useState, useMemo, useCallback } from 'react';
import type { LogLevel, LogRecord } from '../types';

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  fatal: 'FATAL',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  AGENT: 'Agent',
  WORKFLOW: 'Workflow',
  TOOL: 'Tool',
  SYSTEM: 'System',
};

type Comparator = 'is' | 'is not';

export type FilterGroup = { id: string; field: string; comparator: Comparator; values: string[] };
export type FilterColumn = { field: string; plural: string; values: string[] };

function getLogFilterValue(log: LogRecord, field: string): string {
  switch (field) {
    case 'Level':
      return LEVEL_LABELS[log.level];
    case 'Entity type':
      return ENTITY_TYPE_LABELS[log.entityType ?? ''] ?? log.entityType ?? '';
    case 'Entity name':
      return log.entityName ?? '';
    default:
      return '';
  }
}

export function useLogsFilters(logs: LogRecord[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);

  const filterColumns: FilterColumn[] = useMemo(() => {
    const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();
    return [
      { field: 'Level', plural: 'levels', values: unique(logs.map(l => LEVEL_LABELS[l.level])) },
      {
        field: 'Entity type',
        plural: 'types',
        values: unique(logs.map(l => ENTITY_TYPE_LABELS[l.entityType ?? ''] ?? l.entityType ?? '')),
      },
      { field: 'Entity name', plural: 'names', values: unique(logs.map(l => l.entityName ?? '')) },
    ];
  }, [logs]);

  const toggleComparator = useCallback((id: string) => {
    setFilterGroups(prev =>
      prev.map(g => (g.id === id ? { ...g, comparator: g.comparator === 'is' ? 'is not' : 'is' } : g)),
    );
  }, []);

  const removeFilterGroup = useCallback((id: string) => {
    setFilterGroups(prev => prev.filter(g => g.id !== id));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterGroups([]);
  }, []);

  const updateFilterGroups = useCallback((nextState: Record<string, string[]>) => {
    setFilterGroups(prev => {
      const result: FilterGroup[] = [];
      const seen = new Set<string>();

      // Update or keep existing groups
      for (const group of prev) {
        const nextValues = nextState[group.field];
        if (nextValues && nextValues.length > 0) {
          result.push({ ...group, values: nextValues });
          seen.add(group.field);
        }
        // If nextValues is empty/undefined, the group is dropped
      }

      // Add new groups for fields not yet tracked
      for (const [field, values] of Object.entries(nextState)) {
        if (seen.has(field) || values.length === 0) continue;
        result.push({ id: `${field}-${Date.now()}`, field, comparator: 'is', values });
      }

      return result;
    });
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          log.message.toLowerCase().includes(q) ||
          (log.entityName ?? '').toLowerCase().includes(q) ||
          (log.traceId ?? '').toLowerCase().includes(q);
        if (!match) return false;
      }

      for (const group of filterGroups) {
        const logVal = getLogFilterValue(log, group.field);
        const matches = group.values.includes(logVal);
        if (group.comparator === 'is' && !matches) return false;
        if (group.comparator === 'is not' && matches) return false;
      }
      return true;
    });
  }, [logs, searchQuery, filterGroups]);

  return {
    searchQuery,
    setSearchQuery,
    filterGroups,
    filterColumns,
    toggleComparator,
    removeFilterGroup,
    clearAllFilters,
    updateFilterGroups,
    filteredLogs,
  };
}
