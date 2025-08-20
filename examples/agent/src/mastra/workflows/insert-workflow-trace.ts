import { z } from 'zod';
import { createStep, createWorkflow, MastraStorage } from '@mastra/core';

// Main function to insert workflow trace
async function insertWorkflowTrace(workflowData: any, storage: MastraStorage) {
  try {
    const { json } = workflowData.result.data;
    const traceId = json.id;

    console.log(`Inserting workflow trace: ${traceId}`);
    console.log(`Workflow name: ${json.name}`);
    console.log(`Number of observations: ${json.observations.length}`);

    // Create a map of observation ID to our span ID for parent-child relationships
    const spanIdMap = new Map<string, string>();

    // First pass: insert all spans without their parent relationships
    for (const observation of json.observations) {
      // Manually create span data
      const startTime = new Date(observation.startTime).getTime();
      const endTime = new Date(observation.endTime).getTime();
      const createdAt = new Date(observation.startTime);

      // Determine span type based on name
      let spanType = 0; // Default to AGENT_RUN
      if (observation.name.toLowerCase().includes('workflow')) {
        spanType = 3; // WORKFLOW_RUN
      } else if (
        observation.name.toLowerCase().includes('llm') ||
        observation.name.toLowerCase().includes('generate')
      ) {
        spanType = 1; // LLM
      } else if (observation.name.toLowerCase().includes('tool')) {
        spanType = 2; // TOOL_RUN
      }

      // Create attributes
      const attributes: Record<string, any> = {
        latency: observation.latency,
        type: observation.type,
      };

      if (observation.modelParameters) {
        attributes.modelParameters = observation.modelParameters;
      }

      if (observation.usageDetails) {
        attributes.usageDetails = observation.usageDetails;
      }

      if (observation.costDetails) {
        attributes.costDetails = observation.costDetails;
      }

      // Create metadata
      const metadata: Record<string, any> = {
        externalId: observation.id,
      };

      if (observation.model) {
        metadata.model = observation.model;
      }

      // Parse input/output if available
      let input = null;
      let output = null;

      try {
        if (observation.input) {
          input = JSON.parse(observation.input);
        }
      } catch {
        input = observation.input;
      }

      try {
        if (observation.output) {
          output = JSON.parse(observation.output);
        }
      } catch {
        output = observation.output;
      }

      const span = {
        traceId,
        spanId: observation.id, // Changed from `${traceId}-${observation.id}`
        parentSpanId: null, // Will update in second pass
        name: observation.name,
        scope: null,
        spanType,
        attributes,
        metadata,
        events: null,
        links: null,
        other: null,
        startTime,
        endTime,
        createdAt,
        input,
        output,
        error: null,
      };

      // Create the span in storage
      await storage.createAISpan(span);

      // Map the external ID to our internal ID
      spanIdMap.set(observation.id, `${traceId}-${observation.id}`); // Changed back to full database ID format

      console.log(`Inserted span: ${observation.name} (${observation.id})`);
    }

    // Second pass: update parent-child relationships
    for (const observation of json.observations) {
      if (observation.parentObservationId) {
        const spanId = `${traceId}-${observation.id}`; // Changed back to full database ID format
        const parentSpanId = spanIdMap.get(observation.parentObservationId);

        if (parentSpanId) {
          await storage.updateAISpan(spanId, {
            parentSpanId,
          });
          console.log(`Updated parent relationship: ${observation.id} -> ${observation.parentObservationId}`);
        }
      }
    }

    console.log(`\nSuccessfully inserted ${json.observations.length} spans for trace ${traceId}`);

    // Verify the trace was created correctly
    const trace = await storage.getAITrace(traceId);
    if (trace) {
      console.log(`\nTrace verification:`);
      console.log(`- Trace ID: ${trace.traceId}`);
      console.log(`- Total spans: ${trace.spans.length}`);
      console.log(`- Root spans: ${trace.spans.filter(s => s.parentSpanId === null).length}`);
      console.log(`- Child spans: ${trace.spans.filter(s => s.parentSpanId !== null).length}`);
    }
  } catch (error) {
    console.error('Error inserting workflow trace:', error);
    throw error;
  }
}

const createAISpansStep = createStep({
  id: 'create-aispans-step',
  description: 'Create AISpans Step',
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ mastra }) => {
    if (!mastra) {
      throw new Error('Mastra is not initialized');
    }

    const storage = mastra.getStorage();
    if (!storage) {
      throw new Error('Storage is not initialized');
    }
    await insertWorkflowTrace(completeWorkflowData, storage);
    return {
      result: 'suh',
    };
  },
});

export const createAISpansWorkflow = createWorkflow({
  id: 'create-aispans-workflow',
  description: 'Create AISpans Workflow',
  inputSchema: z.any(),
  outputSchema: z.object({
    result: z.string(),
  }),
  steps: [createAISpansStep],
})
  .then(createAISpansStep)
  .commit();

const completeWorkflowData = {
  result: {
    data: {
      json: {
        id: '395513cf93aa6868',
        projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
        name: "workflow run: 'my-workflow'",
        timestamp: '2025-08-20T13:47:21.083Z',
        environment: 'default',
        tags: [],
        bookmarked: false,
        release: null,
        version: null,
        userId: null,
        sessionId: null,
        public: false,
        input: '"{\\"ingredient\\":\\"avocado, call the workflow tool at least once\\"}"',
        output: '"{\\"result\\":\\"suh\\"}"',
        metadata: '{"spanType":"workflow_run","workflowId":"my-workflow"}',
        createdAt: '2025-08-20T13:47:21.083Z',
        updatedAt: '2025-08-20T13:47:45.776Z',
        scores: [],
        latency: 18.712,
        observations: [
          {
            id: 'e755a4f95d55c382',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'GENERATION',
            environment: 'default',
            parentObservationId: 'b5f73659c5a5d58f',
            startTime: '2025-08-20T13:47:35.382Z',
            endTime: '2025-08-20T13:47:39.778Z',
            name: "llm generate: 'gpt-4o'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: { temperature: 0 },
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:36.000Z',
            updatedAt: '2025-08-20T13:47:45.776Z',
            usageDetails: { input: 559, output: 288, total: 847 },
            costDetails: { input: 0.0013975, output: 0.00288, total: 0.0042775 },
            providedCostDetails: {},
            model: 'gpt-4o',
            internalModelId: 'b9854a5c92dc496b997d99d20',
            promptName: null,
            promptVersion: null,
            latency: 4396,
            timeToFirstToken: null,
            inputCost: 0.0013975,
            outputCost: 0.00288,
            totalCost: 0.0042775,
            inputUsage: 559,
            outputUsage: 288,
            totalUsage: 847,
          },
          {
            id: 'b5f73659c5a5d58f',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: 'ce4228a0da91a680',
            startTime: '2025-08-20T13:47:21.095Z',
            endTime: '2025-08-20T13:47:39.781Z',
            name: "agent run: 'Chef Agent Responses'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:22.000Z',
            updatedAt: '2025-08-20T13:47:45.228Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 18686,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
          {
            id: 'ce4228a0da91a680',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: '395513cf93aa6868',
            startTime: '2025-08-20T13:47:21.093Z',
            endTime: '2025-08-20T13:47:39.786Z',
            name: "workflow step: 'my-step-2'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:22.000Z',
            updatedAt: '2025-08-20T13:47:45.196Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 18693,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
          {
            id: '395513cf93aa6868',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: null,
            startTime: '2025-08-20T13:47:21.083Z',
            endTime: '2025-08-20T13:47:39.795Z',
            name: "workflow run: 'my-workflow'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:22.000Z',
            updatedAt: '2025-08-20T13:47:45.156Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 18712,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
          {
            id: '1963f2f172cf4eb6',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'GENERATION',
            environment: 'default',
            parentObservationId: '2aff431841f4dceb',
            startTime: '2025-08-20T13:47:24.777Z',
            endTime: '2025-08-20T13:47:35.370Z',
            name: "llm generate: 'gpt-4o'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: { temperature: 0 },
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:25.000Z',
            updatedAt: '2025-08-20T13:47:41.100Z',
            usageDetails: { input: 450, output: 367, total: 817 },
            costDetails: { input: 0.001125, output: 0.00367, total: 0.004795 },
            providedCostDetails: {},
            model: 'gpt-4o',
            internalModelId: 'b9854a5c92dc496b997d99d20',
            promptName: null,
            promptVersion: null,
            latency: 10593,
            timeToFirstToken: null,
            inputCost: 0.001125,
            outputCost: 0.00367,
            totalCost: 0.004795,
            inputUsage: 450,
            outputUsage: 367,
            totalUsage: 817,
          },
          {
            id: '8866726aefe00edd',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: 'b5f73659c5a5d58f',
            startTime: '2025-08-20T13:47:23.091Z',
            endTime: '2025-08-20T13:47:35.379Z',
            name: "workflow run: 'my-workflow'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:24.000Z',
            updatedAt: '2025-08-20T13:47:41.006Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 12288,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
          {
            id: '2eee6ad507e65144',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: '8866726aefe00edd',
            startTime: '2025-08-20T13:47:23.098Z',
            endTime: '2025-08-20T13:47:35.375Z',
            name: "workflow step: 'my-step-2'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:24.000Z',
            updatedAt: '2025-08-20T13:47:40.732Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 12277,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
          {
            id: '2aff431841f4dceb',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: '2eee6ad507e65144',
            startTime: '2025-08-20T13:47:23.100Z',
            endTime: '2025-08-20T13:47:35.373Z',
            name: "agent run: 'Chef Agent Responses'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:24.000Z',
            updatedAt: '2025-08-20T13:47:40.730Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 12273,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
          {
            id: 'd55adfd86946b802',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: 'b5f73659c5a5d58f',
            startTime: '2025-08-20T13:47:23.090Z',
            endTime: '2025-08-20T13:47:35.379Z',
            name: "tool: 'myWorkflow'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:24.000Z',
            updatedAt: '2025-08-20T13:47:40.723Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 12289,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
          {
            id: '9f237f371e024022',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'GENERATION',
            environment: 'default',
            parentObservationId: '2aff431841f4dceb',
            startTime: '2025-08-20T13:47:23.112Z',
            endTime: '2025-08-20T13:47:24.771Z',
            name: "llm generate: 'gpt-4o'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: { temperature: 0 },
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:24.000Z',
            updatedAt: '2025-08-20T13:47:30.115Z',
            usageDetails: { input: 423, output: 17, total: 440 },
            costDetails: { input: 0.0010575, output: 0.00017, total: 0.0012275 },
            providedCostDetails: {},
            model: 'gpt-4o',
            internalModelId: 'b9854a5c92dc496b997d99d20',
            promptName: null,
            promptVersion: null,
            latency: 1659,
            timeToFirstToken: null,
            inputCost: 0.0010575,
            outputCost: 0.00017,
            totalCost: 0.0012275,
            inputUsage: 423,
            outputUsage: 17,
            totalUsage: 440,
          },
          {
            id: '224e84909362e34c',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: '2aff431841f4dceb',
            startTime: '2025-08-20T13:47:24.772Z',
            endTime: '2025-08-20T13:47:24.776Z',
            name: 'tool: cooking-tool',
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:25.000Z',
            updatedAt: '2025-08-20T13:47:30.029Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 4,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
          {
            id: 'cb0ecf66ec01d8a6',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'GENERATION',
            environment: 'default',
            parentObservationId: 'b5f73659c5a5d58f',
            startTime: '2025-08-20T13:47:21.108Z',
            endTime: '2025-08-20T13:47:23.089Z',
            name: "llm generate: 'gpt-4o'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: { temperature: 0 },
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:22.000Z',
            updatedAt: '2025-08-20T13:47:28.537Z',
            usageDetails: { input: 431, output: 16, total: 447 },
            costDetails: { input: 0.0010775, output: 0.00016, total: 0.001237499999 },
            providedCostDetails: {},
            model: 'gpt-4o',
            internalModelId: 'b9854a5c92dc496b997d99d20',
            promptName: null,
            promptVersion: null,
            latency: 1981,
            timeToFirstToken: null,
            inputCost: 0.0010775,
            outputCost: 0.00016,
            totalCost: 0.001237499999,
            inputUsage: 431,
            outputUsage: 16,
            totalUsage: 447,
          },
          {
            id: '901beafb6ca7290c',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: '8866726aefe00edd',
            startTime: '2025-08-20T13:47:23.091Z',
            endTime: '2025-08-20T13:47:23.093Z',
            name: "workflow step: 'my-step'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:24.000Z',
            updatedAt: '2025-08-20T13:47:28.444Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 2,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
          {
            id: 'f67cd68b9d6b68bc',
            traceId: '395513cf93aa6868',
            projectId: 'cmdei6e8i0wa4ad07mzya8yjk',
            type: 'SPAN',
            environment: 'default',
            parentObservationId: '395513cf93aa6868',
            startTime: '2025-08-20T13:47:21.083Z',
            endTime: '2025-08-20T13:47:21.084Z',
            name: "workflow step: 'my-step'",
            metadata: '{}',
            level: 'DEFAULT',
            statusMessage: null,
            version: null,
            input: null,
            output: null,
            modelParameters: null,
            completionStartTime: null,
            promptId: null,
            createdAt: '2025-08-20T13:47:22.000Z',
            updatedAt: '2025-08-20T13:47:26.613Z',
            usageDetails: {},
            costDetails: {},
            providedCostDetails: {},
            model: null,
            internalModelId: null,
            promptName: null,
            promptVersion: null,
            latency: 1,
            timeToFirstToken: null,
            inputCost: null,
            outputCost: null,
            totalCost: 0,
            inputUsage: 0,
            outputUsage: 0,
            totalUsage: 0,
          },
        ],
      },
    },
  },
};
