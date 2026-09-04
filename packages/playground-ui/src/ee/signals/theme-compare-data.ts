import type { ThemeFlowResponse, TraceSignalName } from './types';

export type ThemeShareDelta = {
  label: string;
  /** The theme's id on whichever compared side still has the theme. */
  themeId?: string;
  /** Share of the signal's traces at point A (0..1). */
  fromShare: number;
  /** Share of the signal's traces at point B (0..1). */
  toShare: number;
  delta: number;
  isNew: boolean;
  isGone: boolean;
};

function stageThemeShares(flow: ThemeFlowResponse, signalName: TraceSignalName) {
  const stage = flow.stages.find(candidate => candidate.signalName === signalName);
  const shares = new Map<string, { share: number; themeId?: string }>();
  if (!stage || stage.traceCount === 0) return shares;
  for (const node of stage.nodes) {
    if (node.kind !== 'theme') continue;
    const entry = shares.get(node.label);
    shares.set(node.label, {
      share: (entry?.share ?? 0) + node.traceCount / stage.traceCount,
      themeId: entry?.themeId ?? node.themeId,
    });
  }
  return shares;
}

/**
 * Per-theme share movement between two snapshots of one signal, largest
 * absolute change first. Powers the compare-mode delta columns.
 */
export function computeThemeShareDeltas(
  fromFlow: ThemeFlowResponse,
  toFlow: ThemeFlowResponse,
  signalName: TraceSignalName,
  limit = 6,
): ThemeShareDelta[] {
  const fromShares = stageThemeShares(fromFlow, signalName);
  const toShares = stageThemeShares(toFlow, signalName);
  const labels = new Set([...fromShares.keys(), ...toShares.keys()]);

  return [...labels]
    .map(label => {
      const fromShare = fromShares.get(label)?.share ?? 0;
      const toShare = toShares.get(label)?.share ?? 0;
      return {
        label,
        themeId: toShares.get(label)?.themeId ?? fromShares.get(label)?.themeId,
        fromShare,
        toShare,
        delta: toShare - fromShare,
        isNew: fromShare === 0 && toShare > 0,
        isGone: fromShare > 0 && toShare === 0,
      };
    })
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, limit);
}

/**
 * Share of one theme across an ordered run of snapshot flows, for compare-mode
 * sparklines. Entries align with the flows array; unloaded flows are skipped
 * by passing undefined.
 */
export function themeShareSeries(
  flows: Array<ThemeFlowResponse | undefined>,
  signalName: TraceSignalName,
  label: string,
): Array<number | undefined> {
  return flows.map(flow => {
    if (!flow) return undefined;
    return stageThemeShares(flow, signalName).get(label)?.share ?? 0;
  });
}
