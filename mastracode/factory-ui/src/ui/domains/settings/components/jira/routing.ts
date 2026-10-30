import { IntakeBindingConflictError } from '../../../factory/services/intake';
import type { IntakeBindingConflict, IntakeSourceBinding } from '../../../factory/services/intake';

export type Factory = { id: string; name: string };

export function factoryName(factories: Factory[], id: string): string {
  return factories.find(factory => factory.id === id)?.name ?? 'another factory';
}

export function jiraBindingsFor(bindings: IntakeSourceBinding[], sourceId: string): IntakeSourceBinding[] {
  return bindings.filter(binding => binding.integrationId === 'jira' && binding.sourceId === sourceId);
}

export function takesAllIssues(binding: IntakeSourceBinding): boolean {
  return (binding.labels ?? null) === null;
}

/** Labels typed comma-separated, trimmed and without blanks. Jira labels never hold spaces. */
export function parseLabels(value: string): { labels: string[] } | { error: string } {
  const labels = value
    .split(',')
    .map(label => label.trim())
    .filter(Boolean);
  const spaced = labels.find(label => /\s/.test(label));
  if (spaced) return { error: `Jira labels can't contain spaces: "${spaced}".` };
  return { labels };
}

/** `added` minus the labels `existing` already holds, compared case-insensitively. */
export function newLabels(existing: string[], added: string[]): string[] {
  const held = new Set(existing.map(label => label.toLowerCase()));
  return added.filter(label => !held.has(label.toLowerCase()));
}

function conflictSentence(conflict: IntakeBindingConflict, factories: Factory[]): string {
  const owner = factoryName(factories, conflict.factoryProjectId);
  if (!conflict.labels) return `${owner} already takes all issues. Add the labels this factory should take.`;
  const labels = conflict.labels.map(label => `"${label}"`).join(', ');
  const one = conflict.labels.length === 1;
  return `${labels} already ${one ? 'goes' : 'go'} to ${owner}. Remove ${one ? 'it' : 'them'} there or pick another label.`;
}

export function routingErrorMessage(error: unknown, factories: Factory[]): string {
  if (error instanceof IntakeBindingConflictError) {
    return error.conflicts.map(conflict => conflictSentence(conflict, factories)).join(' ');
  }
  return error instanceof Error ? error.message : 'Failed to save Jira routing';
}

/** What a factory's routing still lacks before it picks up the issues it shows. */
export function routingGap({
  board,
  labelled,
  labels,
}: {
  board: string | null;
  labelled: boolean;
  labels: string[];
}): string | undefined {
  if (board === null) return "Choose a board — this factory won't pick up issues until one is set.";
  if (labelled && labels.length === 0) return 'Still takes all issues until you add a label.';
  return undefined;
}
