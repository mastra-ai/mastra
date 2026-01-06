import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { BraintrustExporter } from '../src/tracing';
import { Eval } from 'braintrust';
import { initLogger } from 'braintrust';
import { Observability } from '@mastra/observability';

/**
 * Evaluation example using Braintrust's Eval framework.
 *
 * This demonstrates how Mastra agent traces automatically nest inside
 * Braintrust eval task spans. The exporter detects the eval context and
 * attaches Mastra spans to the appropriate eval task.
 *
 * Environment variables required:
 * - BRAINTRUST_API_KEY: Your Braintrust API key
 * - OPENAI_API_KEY: Your OpenAI API key (for the model)
 */

async function main() {
  // Initialize logger
  const logger = initLogger({
    projectName: 'mastra-demo',
    apiKey: process.env.BRAINTRUST_API_KEY,
    appUrl: process.env.BRAINTRUST_API_URL,
  });

  // Pass logger to exporter for context-awareness
  const exporter = new BraintrustExporter({
    braintrustLogger: logger,
  });

  const mastra = new Mastra({
    agents: {
      assistant: new Agent({
        name: 'Assistant',
        instructions: 'Be concise.',
        model: 'openai/gpt-4o-mini',
      }),
    },
    observability: new Observability({
      configs: {
        braintrust: {
          serviceName: 'demo',
          exporters: [exporter],
        },
      },
    }),
  });

  console.log('\n--- Running evaluation ---\n');

  // Run evaluation with Mastra agent
  // Agent traces will automatically nest inside each eval task span
  await Eval('mastra-demo', {
    data: () => [
      { input: 'What is the capital of France?', expected: 'Paris' },
      { input: 'What is 2+2?', expected: '4' },
    ],
    task: async (input: string) => {
      const agent = mastra.getAgent('assistant');
      return (await agent.generate(input)).text;
    },
    scores: [
      (args: any) => ({
        name: 'contains_answer',
        score: String(args.output).toLowerCase().includes(String(args.expected).toLowerCase()) ? 1 : 0,
      }),
    ],
  });

  console.log("\n✓ Check your Braintrust project 'mastra-demo' to see:");
  console.log('  - Eval results with scores');
  console.log('  - Mastra agent traces nested inside each eval task');
  console.log('  - Full trace of model calls and tool usage\n');
}

main().catch(console.error);
