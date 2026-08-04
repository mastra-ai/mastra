import type { ThemeFlowResponse, TraceSignalName } from './types';

export type ThemeLifelinePoint = {
  /** Index into the landmark run this point belongs to. */
  snapshotIndex: number;
  /** Share of the signal's cohort at that landmark (0..1). */
  share: number;
  traceCount: number;
  /** The contributing theme node's id at that landmark, when it has one. */
  themeId?: string;
};

export type ThemeLifeline = {
  label: string;
  points: ThemeLifelinePoint[];
};

export type LifelineConnector = {
  from: ThemeLifelinePoint;
  to: ThemeLifelinePoint;
};

/**
 * Pairs of presence points at consecutive landmarks. Gaps stay unconnected so
 * a theme's absence between two appearances remains visible.
 */
export function lifelineConnectors(points: ThemeLifelinePoint[]): LifelineConnector[] {
  const connectors: LifelineConnector[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    if (to.snapshotIndex === from.snapshotIndex + 1) connectors.push({ from, to });
  }
  return connectors;
}

/**
 * One fixed row per theme label across an ordered run of landmark flows, most
 * persistent first, so stable themes read as continuous spines and transient
 * ones as short segments. Unloaded flows are skipped by passing undefined.
 */
export function buildThemeLifelines(
  flows: Array<ThemeFlowResponse | undefined>,
  signalName: TraceSignalName,
): ThemeLifeline[] {
  const rows = new Map<string, ThemeLifeline>();

  flows.forEach((flow, snapshotIndex) => {
    const stage = flow?.stages.find(candidate => candidate.signalName === signalName);
    if (!stage || stage.traceCount === 0) return;
    for (const node of stage.nodes) {
      if (node.kind !== 'theme') continue;
      const row = rows.get(node.label) ?? { label: node.label, points: [] };
      const lastPoint = row.points[row.points.length - 1];
      if (lastPoint?.snapshotIndex === snapshotIndex) {
        // Duplicate labels within one stage merge into a single presence point.
        lastPoint.share += node.traceCount / stage.traceCount;
        lastPoint.traceCount += node.traceCount;
      } else {
        row.points.push({
          snapshotIndex,
          share: node.traceCount / stage.traceCount,
          traceCount: node.traceCount,
          themeId: node.themeId,
        });
      }
      rows.set(node.label, row);
    }
  });

  return [...rows.values()].sort((left, right) => {
    if (left.points.length !== right.points.length) return right.points.length - left.points.length;
    const firstDifference = left.points[0]!.snapshotIndex - right.points[0]!.snapshotIndex;
    if (firstDifference !== 0) return firstDifference;
    return left.label.localeCompare(right.label);
  });
}
