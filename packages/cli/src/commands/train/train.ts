/**
 * CLI commands for agent training.
 */
import pc from 'picocolors';

import { devLogger } from '../../utils/dev-logger.js';

export interface TrainOptions {
  method: string;
  source: string;
  since?: string;
  until?: string;
  limit?: number;
  minScore?: number;
  maxExamples?: number;
  holdoutRatio?: number;
  baseModel?: string;
  epochs?: number;
  apiKey?: string;
  dir?: string;
  root?: string;
}

export interface TrainStatusOptions {
  jobId: string;
  watch?: boolean;
  dir?: string;
  root?: string;
}

export interface TrainListOptions {
  agent?: string;
  status?: string;
  limit?: number;
  dir?: string;
  root?: string;
}

/**
 * Start a training job for an agent.
 */
export async function trainAgent(agentName: string, options: TrainOptions): Promise<void> {
  console.log(pc.cyan('\n🎯 Mastra Agent Training\n'));
  console.log(pc.dim('─'.repeat(50)));

  console.log(pc.bold('Agent:'), agentName);
  console.log(pc.bold('Method:'), options.method.toUpperCase());
  console.log(pc.bold('Data Source:'), options.source);

  if (options.since) {
    console.log(pc.bold('Since:'), options.since);
  }
  if (options.until) {
    console.log(pc.bold('Until:'), options.until);
  }
  if (options.limit) {
    console.log(pc.bold('Limit:'), options.limit);
  }

  console.log(pc.dim('─'.repeat(50)));
  console.log();

  // Note: Actual training would be done by importing the user's Mastra instance
  // and using the Trainer class. This requires the dev server to be running.

  console.log(pc.yellow('ℹ️  Training is currently available through the Playground UI.'));
  console.log(pc.yellow('   Start your dev server with `mastra dev` and navigate to the Training tab.'));
  console.log();
  console.log(pc.dim('Programmatic training example:'));
  console.log();
  console.log(
    pc.gray(`
import { Trainer } from '@mastra/trainer';
import { OpenAIProvider } from '@mastra/trainer/providers/openai';
import { mastra } from './src/mastra';

const trainer = new Trainer({
  mastra,
  provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }),
});

const result = await trainer.fitAgent(mastra.getAgent('${agentName}'), {
  method: '${options.method}',
  data: {
    source: '${options.source}',
    ${
      options.source === 'traces'
        ? `filter: {
      since: ${options.since ? `new Date('${options.since}')` : 'undefined'},
      until: ${options.until ? `new Date('${options.until}')` : 'undefined'},
      limit: ${options.limit ?? 1000},
    },`
        : 'cases: yourDataset,'
    }
  },
  scoring: {
    composite: { quality: 1.0 },
    gates: [{ scorerId: 'quality', operator: 'gte', threshold: 0.7 }],
  },
  selection: {
    minScore: ${options.minScore ?? 0.7},
    maxExamples: ${options.maxExamples ?? 1000},
    holdoutRatio: ${options.holdoutRatio ?? 0.1},
  },
  provider: {
    kind: 'openai',
    baseModel: '${options.baseModel ?? 'gpt-4o-mini-2024-07-18'}',
    hyperparams: {
      n_epochs: ${options.epochs ?? 3},
    },
  },
});

console.log('Job started:', result.jobId);
`),
  );
}

/**
 * Get status of a training job.
 */
export async function trainStatus(options: TrainStatusOptions): Promise<void> {
  console.log(pc.cyan('\n📊 Training Job Status\n'));
  console.log(pc.dim('─'.repeat(50)));
  console.log(pc.bold('Job ID:'), options.jobId);
  console.log(pc.dim('─'.repeat(50)));
  console.log();

  console.log(pc.yellow('ℹ️  Job status is available through the Playground UI.'));
  console.log(pc.yellow('   Start your dev server with `mastra dev` and navigate to the Training tab.'));
  console.log();
  console.log(pc.dim('Programmatic status check:'));
  console.log();
  console.log(
    pc.gray(`
const job = await trainer.getJob('${options.jobId}');
console.log('Status:', job.status);
console.log('Model:', job.fineTunedModelId);
`),
  );
}

/**
 * List training jobs.
 */
export async function trainList(options: TrainListOptions): Promise<void> {
  console.log(pc.cyan('\n📋 Training Jobs\n'));
  console.log(pc.dim('─'.repeat(50)));

  if (options.agent) {
    console.log(pc.bold('Agent:'), options.agent);
  }
  if (options.status) {
    console.log(pc.bold('Status:'), options.status);
  }

  console.log(pc.dim('─'.repeat(50)));
  console.log();

  console.log(pc.yellow('ℹ️  Job listing is available through the Playground UI.'));
  console.log(pc.yellow('   Start your dev server with `mastra dev` and navigate to the Training tab.'));
  console.log();
  console.log(pc.dim('Programmatic listing:'));
  console.log();
  console.log(
    pc.gray(`
const jobs = await trainer.listJobs(${options.agent ? `'${options.agent}'` : ''});
jobs.forEach(job => {
  console.log(\`\${job.id}: \${job.status} - \${job.fineTunedModelId ?? 'pending'}\`);
});
`),
  );
}

/**
 * Cancel a training job.
 */
export async function trainCancel(jobId: string): Promise<void> {
  console.log(pc.cyan('\n🛑 Cancel Training Job\n'));
  console.log(pc.dim('─'.repeat(50)));
  console.log(pc.bold('Job ID:'), jobId);
  console.log(pc.dim('─'.repeat(50)));
  console.log();

  console.log(pc.yellow('ℹ️  Job cancellation is available through the Playground UI.'));
  console.log(pc.yellow('   Start your dev server with `mastra dev` and navigate to the Training tab.'));
  console.log();
  console.log(pc.dim('Programmatic cancellation:'));
  console.log();
  console.log(
    pc.gray(`
await trainer.cancelJob('${jobId}');
`),
  );
}
