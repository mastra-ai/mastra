import type { IntakeSelection } from './intake-types';

export function toggleSourceId(ids: string[] | null, id: string): string[] | null {
  const current = ids ?? [];
  const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
  return next.length ? next : null;
}

/** A provider syncs exactly the sources picked; `enabled` follows so older servers agree. */
export function withSourceIds(selection: IntakeSelection, sourceIds: string[] | null): IntakeSelection {
  const picked = sourceIds?.length ? sourceIds : null;
  return { ...selection, sourceIds: picked, enabled: picked !== null };
}

export function toggleSource(selection: IntakeSelection, id: string): IntakeSelection {
  return withSourceIds(selection, toggleSourceId(selection.sourceIds, id));
}
