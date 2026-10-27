/**
 * Marks a processor whose state signal also runs on agents without Memory. Internal: the signal
 * goes to the run's message list only, so the lane starts fresh every call (a snapshot on the
 * first step, deltas after).
 */
export const STATE_SIGNAL_WITHOUT_MEMORY = Symbol.for('mastra.processor.stateSignalWithoutMemory');

export function runsStateSignalWithoutMemory(processor: object): boolean {
  return (processor as { [STATE_SIGNAL_WITHOUT_MEMORY]?: unknown })[STATE_SIGNAL_WITHOUT_MEMORY] === true;
}
