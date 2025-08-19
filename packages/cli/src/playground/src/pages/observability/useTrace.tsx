import { useEffect, useState } from 'react';
import { trace } from './data';

// Type definitions for better type safety
interface Observation {
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
}

interface OrganizedSpan extends Observation {
  spans: OrganizedSpan[];
}

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

  return rootObservations;
}

export function useTrace() {
  const [spans, setSpans] = useState<Observation[] | null>(null);
  const [nestedSpans, setNestedSpans] = useState<OrganizedSpan[] | null>(null);
  const [spansIdByStartTime, setSpansIdByStartTime] = useState<Record<string, string>>({});

  useEffect(() => {
    // Simulate fetching trace data
    const observations = trace.observations as Observation[];
    setSpans(observations);

    // Organize observations into tree structure
    const organized = organizeObservationsIntoTree(observations);
    setNestedSpans(organized);
  }, []);

  return {
    trace,
    spans,
    nestedSpans,
  };
}
