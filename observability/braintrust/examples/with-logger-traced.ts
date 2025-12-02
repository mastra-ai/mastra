import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { BraintrustExporter } from '../src/tracing';
import { initLogger } from 'braintrust';
import { Observability } from '@mastra/observability';

/**
 * Context-aware example using logger.traced().
 *
 * This demonstrates how Mastra agent traces automatically nest inside
 * Braintrust spans when using logger.traced(). The exporter detects the
 * external Braintrust span and attaches Mastra spans to it.
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
      demo: new Agent({
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

  // Use logger.traced() to create parent spans with tags and metadata
  // Mastra agent calls will automatically nest inside these spans
  for (const env of ['production', 'staging', 'development']) {
    await logger.traced(async span => {
      // Add tags and metadata to the parent span
      span.log({
        tags: [`environment:${env}`],
        metadata: { environment: env },
      });

      console.log(`\n--- Running in ${env} environment ---`);

      // Agent call will be automatically nested inside the logger.traced() span
      const agent = mastra.getAgent('demo');
      const response = await agent.generate('Say hi');
      console.log(`${env}: ${response.text}`);
    });
  }

  console.log("\n✓ Check your Braintrust project 'mastra-demo' to see:");
  console.log('  - 3 top-level spans (one per environment)');
  console.log('  - Each with environment tags and metadata');
  console.log('  - Mastra agent traces nested inside each span\n');
}

main().catch(console.error);
