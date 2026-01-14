import { usePlaygroundStore } from '@/store/playground-store';
import { useTool } from '@/domains/tools/hooks';
import { useExecuteTool } from '@/domains/tools/hooks/use-execute-tool';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { parse } from 'superjson';
import { z, ZodType } from 'zod';
import { Txt } from '@/ds/components/Txt';
import { Skeleton } from '@/components/ui/skeleton';
import { ToolExecutor } from './ToolExecutor';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { toast } from '@/lib/toast';

// Module-level caches to ensure schema stability across re-renders
const inputSchemaCache = new Map<string, ZodType>();
const requestContextSchemaCache = new Map<string, ZodType>();

function getOrCreateInputSchema(toolId: string, serializedSchema: string): ZodType {
  const cached = inputSchemaCache.get(toolId);
  if (cached) {
    console.log('[InputSchema] Cache HIT for toolId:', toolId);
    return cached;
  }

  console.log('[InputSchema] Cache MISS for toolId:', toolId);
  const parsed = resolveSerializedZodOutput(jsonSchemaToZod(parse(serializedSchema)));
  inputSchemaCache.set(toolId, parsed);
  return parsed;
}

function getOrCreateRequestContextSchema(toolId: string, serializedSchema: string): ZodType {
  const cached = requestContextSchemaCache.get(toolId);
  if (cached) {
    console.log('[RequestContextSchema] Cache HIT for toolId:', toolId);
    return cached;
  }

  console.log('[RequestContextSchema] Cache MISS for toolId:', toolId);
  const parsed = resolveSerializedZodOutput(jsonSchemaToZod(parse(serializedSchema)));
  requestContextSchemaCache.set(toolId, parsed);
  return parsed;
}

export interface ToolPanelProps {
  toolId: string;
}

export const ToolPanel = ({ toolId }: ToolPanelProps) => {
  const { data: agents = {} } = useAgents();
  const requestContextFormDataRef = useRef<Record<string, any>>({});

  // Check if tool exists in any agent's tools
  const agentTool = useMemo(() => {
    for (const agent of Object.values(agents)) {
      if (agent.tools) {
        const tool = Object.values(agent.tools).find(t => t.id === toolId);
        if (tool) {
          return tool;
        }
      }
    }
    return null;
  }, [agents, toolId]);

  // Only fetch from API if tool not found in agents
  const { data: apiTool, isLoading, error } = useTool(toolId!, { enabled: !agentTool });

  const tool: any = agentTool || apiTool;

  const { mutateAsync: executeTool, isPending: isExecuting, data: result } = useExecuteTool();
  const { requestContext: playgroundRequestContext } = usePlaygroundStore();

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tool';
      toast.error(`Error loading tool: ${errorMessage}`);
    }
  }, [error]);

  // Stringify schema to ensure stable dependency comparison
  const requestContextSchemaStr = tool?.requestContextSchema ? JSON.stringify(tool.requestContextSchema) : null;

  // Parse requestContextSchema if it exists - use cache for stability
  const zodRequestContextSchema: ZodType | undefined = useMemo(() => {
    if (!requestContextSchemaStr || !tool?.id) return undefined;
    try {
      return getOrCreateRequestContextSchema(tool.id, tool.requestContextSchema);
    } catch (e) {
      console.error('Error parsing requestContextSchema:', e);
      return undefined;
    }
  }, [tool?.id, requestContextSchemaStr]);

  const handleExecuteTool = useCallback(
    async (data: any) => {
      if (!tool) return;

      // Merge playground requestContext with form-based requestContext
      // Form values take precedence
      const mergedRequestContext = {
        ...playgroundRequestContext,
        ...requestContextFormDataRef.current,
      };

      return executeTool({
        toolId: tool.id,
        input: data,
        requestContext: mergedRequestContext,
      });
    },
    [tool, playgroundRequestContext, executeTool],
  );

  const handleRequestContextChange = useCallback((data: Record<string, any>) => {
    requestContextFormDataRef.current = data;
  }, []);

  // Stringify schema to ensure stable dependency comparison
  const inputSchemaStr = tool?.inputSchema ? JSON.stringify(tool.inputSchema) : null;

  // Use cache for input schema stability as well
  const zodInputSchema = useMemo(() => {
    if (!inputSchemaStr || !tool?.id) return z.object({});
    return getOrCreateInputSchema(tool.id, tool.inputSchema);
  }, [tool?.id, inputSchemaStr]);

  // Store tool in a ref to prevent unmounting during refetches
  const toolRef = useRef(tool);
  if (tool) {
    toolRef.current = tool;
  }
  const stableTool = toolRef.current;

  // Show loading/error only on initial load, not during refetches
  if (!stableTool) {
    if (isLoading) {
      return (
        <div className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }
    if (error) return null;
    return (
      <div className="py-12 text-center px-6">
        <Txt variant="header-md" className="text-icon3">
          Tool not found
        </Txt>
      </div>
    );
  }

  return (
    <ToolExecutor
      executionResult={result}
      isExecutingTool={isExecuting}
      zodInputSchema={zodInputSchema}
      zodRequestContextSchema={zodRequestContextSchema}
      initialRequestContextValues={playgroundRequestContext}
      onRequestContextChange={handleRequestContextChange}
      handleExecuteTool={handleExecuteTool}
      toolDescription={stableTool.description}
      toolId={stableTool.id}
    />
  );
};
