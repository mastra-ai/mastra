/**
 * Common interface and shared types for tool execution components
 */

export interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError: boolean;
}

export interface IToolExecutionComponent {
  updateArgs(args: unknown): void;
  updateResult(result: ToolResult, isPartial?: boolean): void;
  setExpanded(expanded: boolean): void;
  /** Append streaming output for shell commands */
  appendStreamingOutput?(output: string): void;
}
