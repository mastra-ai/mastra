import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

import { DatasetLoader } from '../src/data/loader';
import type { LongMemEvalQuestion } from '../src/data/types';

interface WorkingMemoryTemplate {
  template: string;
  generated_at: string;
  question_type: string;
  question: string;
  answer: string;
}

interface TemplateDatabase {
  [questionId: string]: WorkingMemoryTemplate;
}

async function generateTemplate(question: LongMemEvalQuestion): Promise<string> {
  // Create a simple agent for template generation
  const agent = new Agent({
    name: 'template-generator',
    instructions: `You are an expert at designing working memory templates for AI assistants.

Given a question and answer from a conversation history benchmark, generate a working memory instruction that would help an AI assistant extract and save the specific information needed to answer the question correctly.

The instruction should:
1. Be specific about what information to track
2. Use bullet points to organize different categories
3. Focus ONLY on information directly relevant to answering this specific question
4. Be concise but comprehensive
5. Do not be overly specific, the template should be generic enough to apply generally to the topic at hand, without revealing too much about the answer directly. Overly specific templates will invalidate the usefulness of the recorded information.
${!isNaN(Number(question.answer)) ? '6. A number should be stored counting the relevant data' : '6. If the question involves keeping track of the count or number of something, make that clear in the template'}

Format your response as a clear instruction starting with "Pay close attention to the following information (current and past):"

Then list the specific categories and details to track using bullet points.`,
    model: google('gemini-2.5-flash-preview-04-17'),
  });

  const prompt = `Question Type: ${question.question_type}
Question: "${question.question}"

Generate a working memory instruction specifically tailored for capturing the information needed to answer this question.
If the question involves remembering a specific date or a specific location, make sure that's captured in the template.`;

  const result = await agent.generate(prompt, {
    temperature: 0,
  });

  const template = result.text.trim();

  // Validate that we got a non-empty response
  if (!template || template.length < 50) {
    throw new Error(`Generated template is too short or empty for question ${question.question_id}`);
  }

  return template;
}

async function main() {
  const args = process.argv.slice(2);
  const dataset = args[0] || 'longmemeval_s';
  const concurrency = parseInt(args[1]) || 100; // Default to 5 concurrent generations
  const outputPath = join(process.cwd(), 'prepared-data', 'wm-templates', `${dataset}.json`);

  console.log(chalk.blue('\n🧠 Generating Working Memory Templates\n'));
  console.log(chalk.gray(`Dataset: ${dataset}`));
  console.log(chalk.gray(`Concurrency: ${concurrency}`));
  console.log(chalk.gray(`Output: ${outputPath}`));

  // Set up signal handlers for graceful shutdown
  let interrupted = false;
  let currentSpinner: any = null;
  let cleanupHandler: () => void;

  const baseCleanup = () => {
    interrupted = true;
    if (currentSpinner) {
      currentSpinner.stop();
    }
    console.log(chalk.yellow('\n\n⚠️  Interrupted! Progress has been saved.'));
    console.log(chalk.gray(`Templates saved to: ${outputPath}`));
    process.exit(0);
  };

  cleanupHandler = baseCleanup;

  process.on('SIGINT', () => cleanupHandler());
  process.on('SIGTERM', () => cleanupHandler());

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error(chalk.red('Error: OPENAI_API_KEY environment variable is required'));
    process.exit(1);
  }

  // Load dataset
  const loader = new DatasetLoader();
  const spinner = ora('Loading dataset...').start();
  currentSpinner = spinner;
  const questions = await loader.loadDataset(dataset as any);
  spinner.succeed(`Loaded ${questions.length} questions`);
  currentSpinner = null;

  // Load existing templates if they exist
  let templates: TemplateDatabase = {};
  if (existsSync(outputPath)) {
    const loadSpinner = ora('Loading existing templates...').start();
    currentSpinner = loadSpinner;
    try {
      templates = JSON.parse(await readFile(outputPath, 'utf-8'));
      loadSpinner.succeed(`Loaded ${Object.keys(templates).length} existing templates`);
      currentSpinner = null;

      // Count empty templates
      const emptyTemplates = Object.entries(templates).filter(([_, t]) => !t.template || t.template.length === 0);
      if (emptyTemplates.length > 0) {
        console.log(chalk.yellow(`⚠️  Found ${emptyTemplates.length} empty templates that will be regenerated`));
        // Remove empty templates so they get regenerated
        emptyTemplates.forEach(([id]) => delete templates[id]);
      }
    } catch (e) {
      loadSpinner.warn('Could not load existing templates, starting fresh');
      currentSpinner = null;
    }
  }

  // Process questions
  const questionsToProcess = questions.filter(q => !templates[q.question_id] || !templates[q.question_id].template);

  if (questionsToProcess.length === 0) {
    console.log(chalk.green('\n✅ All questions already have templates!'));
    return;
  }

  console.log(chalk.yellow(`\nGenerating templates for ${questionsToProcess.length} questions...\n`));

  let processed = 0;
  let errors = 0;
  let inProgress = 0;
  const questionQueue = [...questionsToProcess];
  const activeGenerations = new Map<string, Ora>();

  // Update cleanup to have access to activeGenerations
  cleanupHandler = () => {
    interrupted = true;
    if (currentSpinner) {
      currentSpinner.stop();
    }
    activeGenerations.forEach(spinner => spinner.stop());
    console.log(chalk.yellow('\n\n⚠️  Interrupted! Progress has been saved.'));
    console.log(chalk.gray(`Templates saved to: ${outputPath}`));
    process.exit(0);
  };

  // Create directory once
  await mkdir(join(process.cwd(), 'prepared-data', 'wm-templates'), { recursive: true });

  // Main progress spinner
  const mainSpinner = ora({
    text: `Processing: 0/${questionsToProcess.length} (0 in progress)`,
    spinner: 'dots',
  }).start();
  currentSpinner = mainSpinner;

  const updateProgress = () => {
    mainSpinner.text = `Processing: ${processed}/${questionsToProcess.length} (${inProgress} in progress, ${errors} failed)`;
  };

  // Worker function to process a single question
  const processQuestion = async (question: LongMemEvalQuestion): Promise<void> => {
    if (interrupted) return;

    const questionSpinner = ora({
      text: `${question.question_id}: Starting...`,
      prefixText: '  ',
      spinner: 'dots',
    }).start();

    activeGenerations.set(question.question_id, questionSpinner);
    inProgress++;
    updateProgress();

    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;

    while (attempts < maxAttempts && !interrupted) {
      try {
        attempts++;
        if (attempts > 1) {
          questionSpinner.text = `${question.question_id}: Retry ${attempts}/${maxAttempts}...`;
        } else {
          questionSpinner.text = `${question.question_id}: Generating...`;
        }

        const template = await generateTemplate(question);

        templates[question.question_id] = {
          template,
          generated_at: new Date().toISOString(),
          question_type: question.question_type,
          question: question.question,
          answer: question.answer,
        };

        // Save after each successful generation
        await writeFile(outputPath, JSON.stringify(templates, null, 2));

        questionSpinner.succeed(`${question.question_id} (${question.question_type})`);
        activeGenerations.delete(question.question_id);

        processed++;
        inProgress--;
        updateProgress();
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        if (attempts < maxAttempts && !interrupted) {
          // Add a small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if ((attempts === maxAttempts && lastError) || interrupted) {
      if (!interrupted) {
        errors++;
        questionSpinner.fail(`${question.question_id}: ${lastError}`);
      } else {
        questionSpinner.warn(`${question.question_id}: Interrupted`);
      }
      activeGenerations.delete(question.question_id);
      inProgress--;
      updateProgress();
    }
  };

  // Process questions concurrently with a worker pool
  const workers: Promise<void>[] = [];

  while (questionQueue.length > 0 && !interrupted) {
    // Fill up to concurrency limit
    while (workers.length < concurrency && questionQueue.length > 0 && !interrupted) {
      const question = questionQueue.shift()!;
      const workerPromise = processQuestion(question).catch(err => {
        console.error(chalk.red(`Unexpected error processing ${question.question_id}:`), err);
      });
      workers.push(workerPromise);
    }

    // Wait for at least one to complete
    if (workers.length > 0) {
      await Promise.race(workers);
      // Remove completed workers
      for (let i = workers.length - 1; i >= 0; i--) {
        if ((await Promise.race([workers[i], Promise.resolve('pending')])) !== 'pending') {
          workers.splice(i, 1);
        }
      }
    }
  }

  // Wait for remaining workers
  if (!interrupted) {
    await Promise.all(workers);
  }

  // Clean up spinners
  activeGenerations.forEach(spinner => spinner.stop());
  mainSpinner.succeed(`Completed: ${processed}/${questionsToProcess.length} (${errors} failed)`);
  currentSpinner = null;

  // Final summary
  console.log(chalk.blue('\n📊 Summary'));
  console.log(chalk.green(`✓ Successfully generated: ${processed} templates`));
  if (errors > 0) {
    console.log(chalk.red(`✗ Failed: ${errors} templates`));
  }
  console.log(chalk.gray(`Total templates: ${Object.keys(templates).length}`));
  console.log(chalk.gray(`Saved to: ${outputPath}`));
}

main().catch(error => {
  console.error(chalk.red('\nError:'), error.message);
  console.log(chalk.gray('\nUsage: pnpm generate-wm-templates [dataset] [concurrency]'));
  console.log(chalk.gray('  dataset: longmemeval_s (default)'));
  console.log(chalk.gray('  concurrency: number of parallel generations (default: 5)'));
  process.exit(1);
});
