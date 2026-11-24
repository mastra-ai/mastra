/**
 * User-facing wording for a model step that ended on a non-success finish reason.
 * Shared by the agentic loop (plain `Agent.generate`/`stream`) and AgentController so
 * both report the same reason in the same words.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getAnthropicStopDetails(providerMetadata: unknown): Record<string, unknown> | undefined {
  if (!isRecord(providerMetadata)) {
    return undefined;
  }
  const anthropic = providerMetadata.anthropic;
  if (!isRecord(anthropic)) {
    return undefined;
  }
  const stopDetails = anthropic.stopDetails;
  return isRecord(stopDetails) ? stopDetails : undefined;
}

/**
 * Map a non-success terminal finish reason (content-filter, error, length, or a missing reason when the stream closed early) to a
 * user-facing message, or `undefined` for success reasons. A non-success finish
 * must become an explicit terminal error rather than a silent `complete`.
 */
export function describeNonSuccessFinishReason(reason: string, providerMetadata: unknown): string | undefined {
  switch (reason) {
    case 'content-filter': {
      const stopDetails = getAnthropicStopDetails(providerMetadata);
      const explanation =
        stopDetails && typeof stopDetails.explanation === 'string' ? stopDetails.explanation : undefined;
      const category = stopDetails && typeof stopDetails.category === 'string' ? stopDetails.category : undefined;
      const detail = explanation ?? (category ? `category: ${category}` : undefined);
      return detail ? `The model stopped on a content filter (${detail}).` : 'The model stopped on a content filter.';
    }
    case 'error':
      return 'The model stream ended with an error before producing a final response.';
    case 'length':
      return 'The model stopped because it reached its maximum output length before finishing.';
    // The model stream closed without ever sending a finish reason, so the run stopped mid-work.
    case '':
      return 'The model stream ended without a finish reason before producing a final response.';
    default:
      return undefined;
  }
}
