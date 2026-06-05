/** Arguments every per-step agent factory receives — the builder model string. */
export interface AgentFactoryArgs {
  /** The model the builder runs on, resolved by each step agent. */
  model: string;
}
