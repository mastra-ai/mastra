import type { ReasoningView, StretchView, ToolView } from './activity-header';

/** What an open stretch lists: each thought as it was written, and the calls made between two thoughts. */
export type StretchSegment = ReasoningView | ToolView | { kind: 'calls'; key: string; tools: ToolView[] };

/** Calls in a row fold into one group; a call standing alone between thoughts stays a row of its own. */
export function stretchSegments(members: readonly StretchView[]): StretchSegment[] {
  const segments: StretchSegment[] = [];
  let run: ToolView[] = [];
  const closeRun = () => {
    const [first] = run;
    if (first) segments.push(run.length === 1 ? first : { kind: 'calls', key: first.key, tools: run });
    run = [];
  };
  for (const member of members) {
    if (member.kind === 'tool') {
      run.push(member);
      continue;
    }
    closeRun();
    segments.push(member);
  }
  closeRun();
  return segments;
}
