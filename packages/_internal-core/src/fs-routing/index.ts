/**
 * Maximum nesting depth for declared subagents. A top-level agent is depth 0;
 * its subagents are depth 1, and so on. Subagents declared deeper than this
 * are ignored with a warning. The cap keeps delegation trees a sane size and
 * guards `assembleAgentFromFsEntry` against cyclic entry objects.
 */
export const MAX_FS_SUBAGENT_DEPTH = 3;
