/**
 * Training Script
 *
 * This script demonstrates how to use the Mastra Trainer to fine-tune
 * an agent using traces collected from previous interactions.
 *
 * Prerequisites:
 * 1. Run `pnpm seed` to generate traces
 * 2. Set OPENAI_API_KEY environment variable
 *
 * Run with: pnpm train
 */

import { createTrainer } from '@mastra/trainer';
import { OpenAIProvider } from '@mastra/trainer/providers/openai';

import { mastra, supportAgent } from './mastra';

async function train() {
  console.log('🎓 Starting Training Pipeline\n');

  // Ensure we have an API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Create the trainer with OpenAI provider
  const trainer = createTrainer({
    mastra,
    provider: new OpenAIProvider({ apiKey }),
  });

  console.log('📚 Loading traces from storage...\n');

  try {
    // Start the training job using traces as the data source
    const result = await trainer.fitAgent(supportAgent, {
      // Training method: SFT (Supervised Fine-Tuning) or DPO
      method: 'sft',

      // Data source: Use traces from observability storage
      data: {
        source: 'traces',
        filter: {
          agentName: 'Customer Support Agent',
          // Optionally filter by date range
          // since: new Date('2024-12-01'),
          // until: new Date(),
          // Limit number of traces
          limit: 100,
        },
      },

      // Scoring configuration: How to evaluate and select training examples
      scoring: {
        // Composite score weights for each scorer (use scorer IDs)
        composite: {
          'answer-relevancy-scorer': 0.4, // 40% weight on answer relevancy
          'tone-scorer': 0.3, // 30% weight on tone
          'completeness-scorer': 0.3, // 30% weight on completeness
        },
        // Gates: Minimum thresholds that must be met for inclusion
        gates: [
          { scorerId: 'answer-relevancy-scorer', operator: 'gte', threshold: 0.6 },
          { scorerId: 'tone-scorer', operator: 'gte', threshold: 0.5 },
        ],
      },

      // Selection criteria for training examples
      selection: {
        minScore: 0.7, // Minimum composite score
        maxExamples: 50, // Maximum training examples
        dedupe: true, // Remove duplicate inputs
        holdoutRatio: 0.2, // 20% held out for validation
      },

      // Provider-specific configuration
      provider: {
        kind: 'openai',
        baseModel: 'gpt-4o-mini-2024-07-18', // Model to fine-tune
        hyperparams: {
          n_epochs: 3,
          // batch_size: 'auto',
          // learning_rate_multiplier: 'auto',
        },
      },
    });

    console.log('🚀 Training job started!');
    console.log(`   Job ID: ${result.jobId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Training file: ${result.artifacts?.trainingFile}`);
    if (result.artifacts?.validationFile) {
      console.log(`   Validation file: ${result.artifacts?.validationFile}`);
    }

    // Wait for the job to complete (this can take a while)
    console.log('\n⏳ Waiting for training to complete...');
    console.log('   (This can take 10-30 minutes for small datasets)\n');

    const completedJob = await trainer.waitForJob(result.jobId, job => {
      console.log(`   Status: ${job.status}${job.metrics?.steps ? ` (step ${job.metrics.steps})` : ''}`);
    });

    if (completedJob.status === 'succeeded') {
      console.log('\n✅ Training completed successfully!');
      console.log(`   Fine-tuned model: ${completedJob.fineTunedModelId}`);
      if (completedJob.metrics) {
        console.log(`   Training loss: ${completedJob.metrics.trainingLoss}`);
        console.log(`   Validation loss: ${completedJob.metrics.validationLoss}`);
        console.log(`   Trained tokens: ${completedJob.metrics.trainedTokens}`);
      }

      console.log('\n📝 Next steps:');
      console.log('   1. Update your agent to use the fine-tuned model:');
      console.log(`      model: openai('${completedJob.fineTunedModelId}')`);
      console.log('   2. Test the fine-tuned agent with similar prompts');
      console.log('   3. Compare responses to the original model');
    } else if (completedJob.status === 'failed') {
      console.log('\n❌ Training failed!');
      console.log(`   Error: ${completedJob.error}`);
    } else {
      console.log(`\n⚠️ Training ended with status: ${completedJob.status}`);
    }
  } catch (error) {
    console.error('\n❌ Training error:', error instanceof Error ? error.message : error);

    if (error instanceof Error && error.message.includes('No training cases found')) {
      console.log('\n💡 Tip: Run `pnpm seed` first to generate traces for training.');
    }
  }
}

// Also export a function to list existing jobs
async function listJobs() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const trainer = createTrainer({
    mastra,
    provider: new OpenAIProvider({ apiKey }),
  });

  const jobs = await trainer.listJobs();

  console.log('\n📋 Training Jobs:\n');
  if (jobs.length === 0) {
    console.log('   No training jobs found.');
  } else {
    for (const job of jobs) {
      console.log(`   ${job.id}`);
      console.log(`     Status: ${job.status}`);
      console.log(`     Model: ${job.baseModel} → ${job.fineTunedModelId || '(pending)'}`);
      console.log(`     Created: ${job.createdAt}`);
      console.log('');
    }
  }
}

// Run the appropriate command
const command = process.argv[2];

if (command === 'list') {
  listJobs().catch(console.error);
} else {
  train().catch(console.error);
}
