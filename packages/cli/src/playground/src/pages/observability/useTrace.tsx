import { useEffect, useState } from 'react';
import { trace } from './data';

// Type definitions for better type safety
type Observation = {
  id: string;
  traceId: string;
  projectId: string;
  type: string;
  environment: string;
  parentObservationId: string | null;
  startTime: string;
  endTime: string;
  name: string;
  metadata: string;
  level: string;
  statusMessage: string | null;
  version: string | null;
  input: string | null;
  output: string | null;
  modelParameters: any;
  completionStartTime: string | null;
  promptId: string | null;
  createdAt: string;
  updatedAt: string;
  usageDetails: any;
  costDetails: any;
  providedCostDetails: any;
  model: string | null;
  internalModelId: string | null;
  promptName: string | null;
  promptVersion: string | null;
  latency: number;
  timeToFirstToken: string | null;
  inputCost: number | null;
  outputCost: number | null;
  totalCost: number;
  inputUsage: number;
  outputUsage: number;
  totalUsage: number;
};

type OrganizedSpan = Observation & {
  spans: OrganizedSpan[];
};

type OrganizedSpanIds = {
  id: string;
  spans: OrganizedSpanIds[];
};

// Helper function to organize observations into a tree structure
function organizeObservationsIntoTree(observations: Observation[]): OrganizedSpan[] {
  // Create a map for quick lookup
  const observationMap = new Map<string, Observation>();
  const rootObservations: OrganizedSpan[] = [];

  // First pass: create a map of all observations and initialize spans array
  observations.forEach(observation => {
    observationMap.set(observation.id, {
      ...observation,
      spans: [],
    } as OrganizedSpan);
  });

  // Second pass: organize into tree structure
  observations.forEach(observation => {
    const organizedSpan = observationMap.get(observation.id) as OrganizedSpan;

    if (observation.parentObservationId === null) {
      // This is a root observation
      rootObservations.push(organizedSpan);
    } else {
      // This is a child observation
      const parent = observationMap.get(observation.parentObservationId);
      if (parent) {
        (parent as OrganizedSpan).spans.push(organizedSpan);
      } else {
        // If parent doesn't exist, treat as root
        rootObservations.push(organizedSpan);
      }
    }
  });

  // Sort all spans by startTime from earlier to later
  const sortSpansByStartTime = (spans: OrganizedSpan[]): OrganizedSpan[] => {
    return spans.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  // Sort root observations
  const sortedRootObservations = sortSpansByStartTime(rootObservations);

  // Sort all nested spans recursively
  const sortNestedSpans = (spans: OrganizedSpan[]): void => {
    spans.forEach(span => {
      if (span.spans.length > 0) {
        span.spans = sortSpansByStartTime(span.spans);
        sortNestedSpans(span.spans);
      }
    });
  };

  sortNestedSpans(sortedRootObservations);

  return sortedRootObservations;
}

// Helper function to flatten nested spans into array of IDs ordered by parent and startTime
function flattenNestedSpansToIds(nestedSpans: OrganizedSpan[]): string[] {
  const flattenedIds: string[] = [];

  const traverseAndCollect = (spans: OrganizedSpan[]): void => {
    spans.forEach(span => {
      // Add current span ID
      flattenedIds.push(span.id);

      // Recursively traverse child spans
      if (span.spans.length > 0) {
        traverseAndCollect(span.spans);
      }
    });
  };

  traverseAndCollect(nestedSpans);
  return flattenedIds;
}

export function useTrace() {
  const [spans, setSpans] = useState<Observation[] | null>(null);
  const [nestedSpans, setNestedSpans] = useState<OrganizedSpan[] | null>(null);
  const [spansIdsByStartTime, setSpansIdsByStartTime] = useState<Observation[]>([]);
  const [spanIds, setSpanIds] = useState<string[]>([]);

  useEffect(() => {
    // Simulate fetching trace data
    const observations = trace.observations as Observation[];
    setSpans(observations);

    // Organize observations into tree structure
    const nested = organizeObservationsIntoTree(observations);
    setNestedSpans(nested);

    // Flatten nested spans to array of IDs ordered by parent and startTime
    const spanIds = flattenNestedSpansToIds(nested);
    setSpanIds(spanIds);

    // Set array of observations as spansIdsByStartTime, ordered by startTime from earlier to later
    const sortedObservations = [...observations].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    setSpansIdsByStartTime(sortedObservations);
  }, []);

  return {
    trace,
    spans,
    nestedSpans,
    spansIdsByStartTime,
    spanIds,
  };
}
