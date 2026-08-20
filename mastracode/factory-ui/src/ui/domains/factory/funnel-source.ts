/**
 * What a ribbon's stops mean, per board. Geometry lives in `funnel.ts`; this is
 * where a board's numbers become stops, notes and tooltips.
 */

import { formatDuration } from '../../../lib/date';
import type { FunnelSource, FunnelStop } from './funnel';
import type { FactoryMetrics } from './services/metrics';
import { stageLabel, stagePaint } from './stages';

type Funnel = FactoryMetrics['funnel'];
type Coverage = FactoryMetrics['agentCoverage'];
type StageDwell = FactoryMetrics['stageDwell'];
type FunnelGate = Funnel['gates'][number];

/** What the gate held on to, or `null` when everything moved on. */
function stoppedNote(gate: FunnelGate): string | null {
  const parts: string[] = [];
  if (gate.stalled > 0) parts.push(`${gate.stalled} still here`);
  if (gate.canceled > 0) parts.push(`${gate.canceled} abandoned`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Share of the stage's passes an agent closed, or `null` when the window
 * recorded no closed pass. Read off the coverage rows rather than the hop
 * counts: a card that skips a stage records no hop, so hop shares read as
 * "a person did all of it" on stages nobody hopped through.
 */
function agentShareOf(coverage: Coverage, stage: string): number | null {
  const row = coverage.find(entry => entry.stage === stage);
  return row && row.passes > 0 ? row.byAgent / row.passes : null;
}

/** The work board: the cohort pulled in, gate by gate, down to shipped. */
export function workFunnel(funnel: Funnel, coverage: Coverage, stageDwell: StageDwell): FunnelSource {
  const cohort = funnel.gates[0]?.reached ?? 0;
  const order = new Map(funnel.gates.map((gate, index) => [gate.stage, index]));
  const backward = funnel.edges
    .filter(edge => {
      const from = order.get(edge.from);
      const to = order.get(edge.to);
      return from !== undefined && to !== undefined && to < from;
    })
    .sort((a, b) => b.count - a.count)[0];

  const stops = funnel.gates.map((gate, index): FunnelStop => {
    const next = funnel.gates[index + 1];
    const dwell = stageDwell.find(row => row.stage === gate.stage);
    const agentShare = agentShareOf(coverage, gate.stage);
    return {
      key: gate.stage,
      label: stageLabel(gate.stage),
      reached: gate.reached,
      color: stagePaint(gate.stage).color,
      coreShare: agentShare,
      dwellMs: dwell?.medianMs,
      note: stoppedNote(gate),
      detail: [
        next ? `${gate.reached} of ${cohort} cards got this far` : `${gate.reached} of the ${cohort} pulled in shipped`,
        ...(gate.stalled > 0 ? [`${gate.stalled} still in ${stageLabel(gate.stage)}`] : []),
        ...(gate.canceled > 0 ? [`${gate.canceled} abandoned here`] : []),
      ],
      flowDetail: next && [
        `${next.reached} of ${gate.reached} moved on`,
        agentShare === null
          ? `No ${stageLabel(gate.stage)} pass closed in this window`
          : `${Math.round(agentShare * 100)}% of ${stageLabel(gate.stage)} passes closed by an agent`,
        ...(dwell
          ? [
              `Median ${formatDuration(dwell.medianMs)} in ${stageLabel(gate.stage)} · p90 ${formatDuration(dwell.p90Ms)}`,
            ]
          : []),
        ...(stoppedNote(gate) ? [stoppedNote(gate)!] : []),
      ],
    };
  });

  return {
    stops,
    coreLegend: 'closed by an agent',
    dwellCaption: 'median in stage',
    back: backward
      ? {
          from: backward.from,
          to: backward.to,
          // the arrow already says where it went back to; what it costs is what it adds
          note: `${backward.count} sent back${funnel.rework.medianExtraMs === null ? '' : ` · +${formatDuration(funnel.rework.medianExtraMs)} each`}`,
          described: `${backward.count} sent back from ${stageLabel(backward.from)} to ${stageLabel(backward.to)} · median ${formatDuration(backward.dwellMedianMs)} before the hop`,
        }
      : null,
    empty: 'Nothing entered the pipeline in this window.',
  };
}

/**
 * The review board: pull requests filed at the Factory, the ones it started on,
 * and the reviews it finished. The last stop counts the window's completions, so
 * a review filed before the window still lands here — spelled out in its tooltip
 * rather than hidden behind a stop that pretends to be the same cohort.
 */
export function reviewFunnel(review: FactoryMetrics['review']): FunnelSource {
  const { arrived, pickedUp } = review.intake;
  const ignored = arrived - pickedUp;
  const median = review.leadTime.medianMs;

  return {
    stops: [
      {
        key: 'filed',
        label: 'Filed',
        reached: arrived,
        color: stagePaint('triage').color,
        note: ignored > 0 ? `${ignored} never started` : null,
        detail: [`${arrived} pull requests filed in this window`],
        flowDetail: [
          `${pickedUp} of ${arrived} were picked up`,
          ...(ignored > 0 ? [`${ignored} nobody started a review on`] : []),
        ],
      },
      {
        key: 'picked-up',
        label: 'Picked up',
        reached: pickedUp,
        color: stagePaint('review').color,
        detail: [`${pickedUp} of the ${arrived} filed got a review started`],
        flowDetail: [
          `${review.completed} reviews finished in this window`,
          ...(median === null ? [] : [`Median ${formatDuration(median)} from filed to reviewed`]),
        ],
      },
      {
        key: 'reviewed',
        label: 'Reviewed',
        reached: review.completed,
        color: stagePaint('done').color,
        detail: [`${review.completed} reviews finished in this window`],
      },
    ],
    coreLegend: null,
    dwellCaption: null,
    back: null,
    empty: 'No review thread moved in this window.',
  };
}
