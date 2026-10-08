import type { SerializedMessageListState } from '../../../message-list/state';

type MessageListStateCarrier = { messageListState?: SerializedMessageListState };

/**
 * Where the serialized transcript (`messageListState`) lives between steps.
 *
 * The durable loop seeds it into workflow state once (`init-iteration-state`),
 * so every persisted snapshot carries a single copy in `value` instead of one
 * per step payload. Runs that never seeded it — those persisted before the
 * move, or workflows composing these steps without seeding — keep threading
 * it through step input/output unchanged.
 */
export function readMessageListState(workflowState: unknown, stepPayload: unknown): SerializedMessageListState {
  // Every durable run carries the transcript in at least one of the two;
  // workflow state wins.
  return ((workflowState as MessageListStateCarrier | undefined)?.messageListState ??
    (stepPayload as MessageListStateCarrier).messageListState) as SerializedMessageListState;
}

/**
 * Stores an updated transcript where this run keeps it. Returns the fields to
 * spread into the step output: nothing when it went to workflow state,
 * `{ messageListState }` when the run threads it through step payloads.
 */
export async function storeMessageListState(
  params: { state: unknown; setState(state: unknown): Promise<void> },
  messageListState: SerializedMessageListState,
): Promise<MessageListStateCarrier> {
  const workflowState = params.state as MessageListStateCarrier | undefined;
  if (workflowState?.messageListState === undefined) {
    return { messageListState };
  }
  // The default engine replaces state wholesale on setState.
  await params.setState({ ...workflowState, messageListState });
  return {};
}
