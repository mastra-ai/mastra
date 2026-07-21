const PRE_RUN_STAGES = ['intake', 'triage', 'planning'];

export function hasLabel(labels: readonly string[], label: string): boolean {
  return labels.some(item => item.toLowerCase() === label);
}

export function metadataLabels(metadata: Record<string, unknown>): string[] {
  return Array.isArray(metadata.labels)
    ? metadata.labels.filter((label): label is string => typeof label === 'string')
    : [];
}

export function stagesAfterMove(stages: string[], from: string | null, to: string): string[] {
  if (to === 'done') return ['done'];
  const rest = stages.filter(stage => stage !== from && stage !== to && stage !== 'done');
  return [...rest, to];
}

export function stagesAfterRunStart(stages: string[], to: string): string[] {
  return stagesAfterMove(
    stages.filter(stage => !PRE_RUN_STAGES.includes(stage)),
    null,
    to,
  );
}

export function guidedPrompt(base: string, instructions: string): string {
  return `${base}\n\nGuidance for this run: ${instructions}`;
}

export function excludeFiledBySourceKey<T extends { sourceKey: string }>(
  candidates: T[],
  workItems: ReadonlyArray<{ sourceKey: string | null }> | undefined,
): T[] {
  const filedKeys = new Set((workItems ?? []).flatMap(item => (item.sourceKey ? [item.sourceKey] : [])));
  return candidates.filter(candidate => !filedKeys.has(candidate.sourceKey));
}
