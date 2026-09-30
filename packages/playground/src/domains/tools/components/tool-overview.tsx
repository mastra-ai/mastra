import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import type { ReactNode } from 'react';
import { ToolSchemaFields } from './tool-schema-fields';

export interface ToolOverviewProps {
  inputSchema: unknown;
  outputSchema?: unknown;
  requestContextSchema?: unknown;
  /** Side column, e.g. the agents that use this tool. */
  aside?: ReactNode;
}

export function ToolOverview({ inputSchema, outputSchema, requestContextSchema, aside }: ToolOverviewProps) {
  return (
    <div className="grid content-start items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="grid min-w-0 gap-4">
        <SectionCard title="Input" description="What the tool expects when it's called.">
          <ToolSchemaFields schema={inputSchema} emptyMessage="This tool takes no input." defaultsAreOptional />
        </SectionCard>
        <SectionCard title="Output" description="What the tool returns.">
          <ToolSchemaFields schema={outputSchema} emptyMessage="No output schema defined." />
        </SectionCard>
        {requestContextSchema !== undefined && (
          <SectionCard title="Request context" description="Runtime values the tool reads, like the current user.">
            <ToolSchemaFields
              schema={requestContextSchema}
              emptyMessage="No request context fields."
              defaultsAreOptional
            />
          </SectionCard>
        )}
      </div>
      {aside}
    </div>
  );
}
