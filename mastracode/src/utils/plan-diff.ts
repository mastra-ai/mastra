/**
 * Line-level diffing for plan revisions.
 *
 * Uses a real LCS (longest common subsequence) diff so that inserting or deleting a few
 * lines doesn't mark everything after it as changed. Both the rendered approval diff and
 * the "is a diff worth showing" heuristic share this so the heuristic measures the actual
 * diff rather than predicting one.
 */

export interface DiffEntry {
  type: 'added' | 'removed' | 'context';
  text: string;
}

/** Produce structured diff entries between two plan texts using an LCS diff. */
export function generatePlanDiff(oldText: string, newText: string): DiffEntry[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const n = oldLines.length;
  const m = newLines.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = oldLines[i] === newLines[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const entries: DiffEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      entries.push({ type: 'context', text: oldLines[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      entries.push({ type: 'removed', text: oldLines[i]! });
      i++;
    } else {
      entries.push({ type: 'added', text: newLines[j]! });
      j++;
    }
  }
  while (i < n) entries.push({ type: 'removed', text: oldLines[i++]! });
  while (j < m) entries.push({ type: 'added', text: newLines[j++]! });

  return entries;
}

/**
 * Decide whether a diff is worth rendering instead of just showing the full new plan.
 *
 * We generate the real diff and compare its size (added + removed lines) against the size
 * of the whole diff (added + removed + unchanged context). When most of the diff is changes
 * rather than shared context, the diff is no clearer than the full text, so callers fall
 * back to rendering the whole plan. A genuinely new plan (no previous text, or no shared
 * lines) is therefore shown in full.
 */
export function shouldShowDiff(previousPlan: string, plan: string, maxChangedRatio = 0.5): boolean {
  if (!previousPlan || previousPlan === plan) return false;

  const entries = generatePlanDiff(previousPlan, plan);
  const changed = entries.filter(e => e.type !== 'context').length;
  if (changed === 0) return false;

  // changed / total entries == diff size relative to the full plan view.
  return changed / Math.max(entries.length, 1) <= maxChangedRatio;
}
