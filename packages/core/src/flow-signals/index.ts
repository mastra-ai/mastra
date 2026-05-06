/**
 * Flow Signals define a pure, serializable decision contract for agentic control flow.
 *
 * This entrypoint does not execute decisions and does not replace Mastra processors or
 * Harness orchestration. Processors remain the runtime hook layer that can translate
 * FlowDecision actions into model, tool, output, TripWire, retry, or validation behavior.
 * Harness may translate FlowDecision actions into user-facing awaiting-input flows.
 * Processor and Harness adapter types are intentionally not exported from this
 * experimental surface yet; add them with concrete integrations once the runtime
 * mapping is proven.
 *
 * `FLOW_SIGNALS_VERSION` is a lockstep envelope version for the v1 schemas in
 * this entrypoint. Split schema-specific versions only when a persisted runtime
 * consumer needs independent migration.
 *
 * Intended adapter direction:
 * processor or harness runtime state -> DecisionFrame -> selectFlowDecision -> processor or harness action.
 */
export * from './schemas';
export * from './selector';
