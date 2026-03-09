import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { BraintrustExporter } from '../src/tracing';
import { initLogger } from 'braintrust';
import { Observability } from '@mastra/observability';

/**
 * Basic usage example showing both approaches.
 *
 * Environment variables required:
 * - BRAINTRUST_API_KEY: Your Braintrust API key
 * - OPENAI_API_KEY: Your OpenAI API key (for the model)
 */

async function exampleStandardApproach() {
  console.log('\n=== Standard Approach: Pass apiKey, exporter creates loggers per trace ===\n');

  // Pass apiKey and projectName to the exporter config
  const exporter = new BraintrustExporter({
    apiKey: process.env.BRAINTRUST_API_KEY,
    projectName: 'mastra-demo',
  });

  const mastra = new Mastra({
    agents: {
      demo: new Agent({
        name: 'Assistant',
        instructions: 'Be helpful and concise.',
        model: 'openai/gpt-4o',
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

  const agent = mastra.getAgent('demo');
  const response = await agent.generate('What is 2+2?');
  console.log('Response:', response.text);
  console.log("✓ Check your Braintrust project 'mastra-demo' for the trace");
}

async function exampleContextAwareApproach() {
  console.log('\n=== Context-Aware Approach: Pass logger instance for Braintrust context integration ===\n');

  // Initialize logger yourself and pass it to the exporter
  const logger = initLogger({
    projectName: 'mastra-demo',
    apiKey: process.env.BRAINTRUST_API_KEY,
    appUrl: process.env.BRAINTRUST_API_URL,
  });

  const exporter = new BraintrustExporter({
    braintrustLogger: logger, // Enables integration with Braintrust contexts
  });

  const mastra = new Mastra({
    agents: {
      demo: new Agent({
        name: 'Assistant',
        instructions: 'Be helpful and concise.',
        model: 'openai/gpt-4o',
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

  const agent = mastra.getAgent('demo');
  const response = await agent.generate('What is 2+2?');
  console.log('Response:', response.text);
  console.log("✓ Check your Braintrust project 'mastra-demo' for the trace");
}

async function main() {
  // Run both approaches to demonstrate the difference
  await exampleStandardApproach();
  await exampleContextAwareApproach();

  console.log('\n✨ Done! Both approaches work.');
  console.log('   Passing a logger enables integration with Braintrust contexts (Evals, logger.traced()).');
  console.log('   See with-logger-traced.ts and with-eval.ts for examples.\n');
}

main().catch(console.error);
