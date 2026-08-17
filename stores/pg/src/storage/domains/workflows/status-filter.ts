/**
 * Builds the `status` filter predicate used by `WorkflowsPG.listWorkflowRuns`.
 *
 * On a `jsonb` snapshot column the stored value is guaranteed to be valid JSON.
 * Postgres rejects NUL and unpaired-surrogate escapes at insert time, so `status`
 * is read directly. This keeps the predicate indexable (e.g. a btree on
 * `(snapshot ->> 'status')`), avoiding the full table scan that the sanitizing
 * form forces.
 *
 * On a `json`/`text` column those escapes can be stored and would make a `::jsonb`
 * cast throw `22P05`, so they are stripped first. That path is not indexable but
 * preserves the fix from https://github.com/mastra-ai/mastra/issues/11563.
 *
 * @param isJsonbSnapshot Whether the live `snapshot` column type is `jsonb`.
 * @param paramIndex The 1-based positional parameter index for the status value.
 */
export function buildWorkflowStatusFilter(isJsonbSnapshot: boolean, paramIndex: number): string {
  if (isJsonbSnapshot) {
    return `snapshot ->> 'status' = $${paramIndex}`;
  }

  return `regexp_replace(snapshot::text, '\\\\u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})', '', 'g')::jsonb ->> 'status' = $${paramIndex}`;
}
