export type LinearNamedItem = Readonly<{ id: string; name: string }>;
export type LinearState = LinearNamedItem & Readonly<{ type: string; position: number }>;
export type LinearLabel = LinearNamedItem & Readonly<{ teamId?: string }>;
const phases: Record<string, readonly [string, string]> = {
  received: ['backlog', 'Backlog'],
  investigating: ['started', 'In Progress'],
  awaiting_approval: ['started', 'In Progress'],
  approved: ['started', 'In Progress'],
  containing: ['started', 'In Progress'],
  contained: ['completed', 'Done'],
  closed: ['completed', 'Done'],
  failed: ['started', 'In Progress'],
  rejected: ['canceled', 'Canceled'],
};
const normalize = (name: string) => name.trim().toLocaleLowerCase('en-US');

/** Resolve names only within the verified destination; never create labels/states. */
export function resolveLinearWorkflowMapping(
  input: Readonly<{
    teamId: string;
    states: readonly LinearState[];
    labels: readonly LinearLabel[];
    severityLabelNames?: Readonly<Record<string, string>>;
    statusStateNames?: Readonly<Record<string, string>>;
    severityLabelIds?: Readonly<Record<string, string>>;
    statusStateIds?: Readonly<Record<string, string>>;
  }>,
) {
  const statusStateIds: Record<string, string> = { ...input.statusStateIds };
  const severityLabelIds: Record<string, string> = {
    ...input.severityLabelIds,
  };
  for (const [phase, [type, defaultName]] of Object.entries(phases)) {
    const explicit = input.statusStateNames?.[phase];
    if (explicit) {
      statusStateIds[phase] = unique(input.states, explicit, `LINEAR_STATUS_STATE_NAMES_JSON.${phase}`).id;
    } else if (!statusStateIds[phase]) {
      const candidates = input.states.filter(state => state.type === type);
      const ordered = [...candidates].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
      const state = ordered.find(item => normalize(item.name) === normalize(defaultName)) ?? ordered[0];
      if (!state)
        throw new Error(
          `Linear team has no ${type} workflow state. Configure LINEAR_STATUS_STATE_NAMES_JSON.${phase}.`,
        );
      statusStateIds[phase] = state.id;
    }
  }
  for (const severity of ['low', 'medium', 'high', 'critical']) {
    const explicit = input.severityLabelNames?.[severity];
    if (!explicit && severityLabelIds[severity]) continue;
    const name = explicit ?? severity;
    const matches = input.labels.filter(
      label => normalize(label.name) === normalize(name) && (!label.teamId || label.teamId === input.teamId),
    );
    const local = matches.filter(label => label.teamId === input.teamId);
    const candidates = local.length ? local : matches;
    if (explicit)
      severityLabelIds[severity] = unique(candidates, name, `LINEAR_SEVERITY_LABEL_NAMES_JSON.${severity}`).id;
    else if (candidates.length === 1) severityLabelIds[severity] = candidates[0]!.id;
    // Optional default labels may not exist: native priorities still apply.
  }
  return { statusStateIds, severityLabelIds };
}
function unique(items: readonly LinearNamedItem[], name: string, setting: string) {
  const matches = items.filter(item => normalize(item.name) === normalize(name));
  if (matches.length !== 1)
    throw new Error(
      `Linear name "${name}" for ${setting} must match exactly one item in the configured team/workspace.`,
    );
  return matches[0]!;
}
