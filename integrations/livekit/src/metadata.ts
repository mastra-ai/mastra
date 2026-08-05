/**
 * Session metadata passed from the Mastra server to the LiveKit agent worker through
 * LiveKit's job dispatch metadata (a plain string, so this is JSON-serialized).
 */
export interface LiveKitSessionMetadata {
  /** Mastra agent to run, by registered key or agent id. */
  agentId?: string;
  /** Memory thread id. Defaults to the LiveKit room name when omitted. */
  threadId?: string;
  /** Memory resource id (typically the end user id). */
  resourceId?: string;
  /** Plain-object entries restored into a RequestContext for agent execution. */
  requestContext?: Record<string, unknown>;
}

export function parseSessionMetadata(raw: string | undefined | null): LiveKitSessionMetadata {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as LiveKitSessionMetadata;
    }
  } catch {
    // Dispatch metadata is user-controlled and may not be JSON; treat as absent.
  }
  return {};
}

export function serializeSessionMetadata(metadata: LiveKitSessionMetadata): string {
  return JSON.stringify(metadata);
}
