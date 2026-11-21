import { IntakeBindingConflictError } from '../../../factory/services/intake';
import type { IntakeBindingConflict, IntakeSourceBinding } from '../../../factory/services/intake';
import type { RoutingTerms } from './terms';

export type Factory = { id: string; name: string };

export function factoryName(factories: Factory[], id: string): string {
  return factories.find(factory => factory.id === id)?.name ?? 'another factory';
}

export function bindingsFor(
  bindings: IntakeSourceBinding[],
  integrationId: string,
  sourceId: string,
): IntakeSourceBinding[] {
  return bindings.filter(binding => binding.integrationId === integrationId && binding.sourceId === sourceId);
}

export function takesAllIssues(binding: IntakeSourceBinding): boolean {
  return (binding.labels ?? null) === null;
}

/** Labels typed comma-separated, trimmed and without blanks. Routing labels never hold spaces. */
export function parseLabels(value: string, terms: RoutingTerms): { labels: string[] } | { error: string } {
  const labels = value
    .split(',')
    .map(label => label.trim())
    .filter(Boolean);
  const spaced = labels.find(label => /\s/.test(label));
  if (spaced) return { error: `${terms.provider} labels can't contain spaces: "${spaced}".` };
  return { labels };
}

/** `added` minus the labels `existing` already holds, compared case-insensitively. */
export function newLabels(existing: string[], added: string[]): string[] {
  const held = new Set(existing.map(label => label.toLowerCase()));
  return added.filter(label => !held.has(label.toLowerCase()));
}

function conflictSentence(conflict: IntakeBindingConflict, factories: Factory[], terms: RoutingTerms): string {
  const owner = factoryName(factories, conflict.factoryProjectId);
  if (!conflict.labels) return `${owner} already takes all ${terms.items}. Add the labels this factory should take.`;
  const labels = conflict.labels.map(label => `"${label}"`).join(', ');
  const one = conflict.labels.length === 1;
  return `${labels} already ${one ? 'goes' : 'go'} to ${owner}. Remove ${one ? 'it' : 'them'} there or pick another label.`;
}

export function routingErrorMessage(error: unknown, factories: Factory[], terms: RoutingTerms): string {
  if (error instanceof IntakeBindingConflictError) {
    return error.conflicts.map(conflict => conflictSentence(conflict, factories, terms)).join(' ');
  }
  return error instanceof Error ? error.message : `Failed to save ${terms.provider} routing`;
}

/** What a factory's routing still lacks before it takes only the items it shows. */
export function routingGap(
  { labelled, labels }: { labelled: boolean; labels: string[] },
  terms: RoutingTerms,
): string | undefined {
  if (labelled && labels.length === 0) return `Still takes all ${terms.items} until you add a label.`;
  return undefined;
}
