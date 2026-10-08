import type { RequestContextEntityType } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useState } from 'react';
import type { ZodType } from 'zod';
import type { ToolExecution } from '../utils/tool-run';
import { toToolRun } from '../utils/tool-run';
import { ToolPlaygroundLayout } from './tool-playground-layout';
import { ToolRequest } from './tool-request';
import { ToolResponse } from './tool-response';

export interface ToolPlaygroundProps {
  zodInputSchema: ZodType;
  /** The tool's run mutation: how to run it, plus its status, output and error. */
  execution: ToolExecution;
  requestContextEntityType: RequestContextEntityType;
  requestContextEntityId: string;
  variant?: 'inline' | 'workspace';
}

/** The Playground tab: the request form, then the last response. */
export function ToolPlayground({
  zodInputSchema,
  execution,
  requestContextEntityType,
  requestContextEntityId,
  variant = 'inline',
}: ToolPlaygroundProps) {
  const [requestContext] = useEntityRequestContext(requestContextEntityType, requestContextEntityId);
  // The mutation holds the outcome; only how long the last run took isn't part of its state.
  const [durationMs, setDurationMs] = useState<number>();

  const runTool = async (data: unknown) => {
    const startedAt = performance.now();
    // A failed run is shown from the mutation's error, so the rejection needs no handling here.
    await execution.execute(data, requestContext).catch(() => undefined);
    setDurationMs(performance.now() - startedAt);
  };

  const isRunning = execution.status === 'pending';

  return (
    <ToolPlaygroundLayout
      variant={variant}
      request={
        <ToolRequest
          zodInputSchema={zodInputSchema}
          isRunning={isRunning}
          onRun={runTool}
          requestContextEntityType={requestContextEntityType}
          requestContextEntityId={requestContextEntityId}
        />
      }
      response={<ToolResponse isRunning={isRunning} lastRun={toToolRun(execution, durationMs)} />}
    />
  );
}
