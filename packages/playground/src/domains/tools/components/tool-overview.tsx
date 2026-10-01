import type { ReactNode } from 'react';
import { ToolSchemaSection } from './tool-drawer/tool-schema-section';

export interface ToolOverviewProps {
  inputSchema: unknown;
  outputSchema?: unknown;
  requestContextSchema?: unknown;
  /** Trailing section, e.g. the agents that use this tool. */
  footer?: ReactNode;
}

export function ToolOverview({ inputSchema, outputSchema, requestContextSchema, footer }: ToolOverviewProps) {
  return (
    <div className="grid gap-6">
      <ToolSchemaSection
        title="Input"
        schema={inputSchema}
        emptyMessage="This tool takes no input."
        defaultsAreOptional
      />
      <ToolSchemaSection title="Output" schema={outputSchema} emptyMessage="No output schema defined." />
      {requestContextSchema !== undefined && (
        <ToolSchemaSection
          title="Request context"
          schema={requestContextSchema}
          emptyMessage="No request context fields."
          defaultsAreOptional
        />
      )}
      {footer}
    </div>
  );
}
