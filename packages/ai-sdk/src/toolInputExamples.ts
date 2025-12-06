// packages/ai-sdk/src/toolInputExamples.ts

/**
 * Represents a single example of input for a tool.
 * The `input` should conform to the tool's parameters JSON schema.
 * An optional `description` can provide context for the example.
 */
export interface ToolInputExample {
  /** Example input object matching the tool's parameters schema */
  input: Record<string, any>;
  /** Optional description of the example */
  description?: string;
}
