/** Form fields the shared agent-edit tabs read and write. Hosts may carry more. */
export interface AgentEditFormValues {
  name?: string;
  description?: string;
  instructions?: string;
  skills?: Record<string, boolean>;
}
