/**
 * Seeds a dataset and ten agent experiments against `chef-model-v2-agent`, so the
 * Studio experiments list can compare up to ten runs side by side.
 *
 * Each experiment runs the real agent pipeline (dataset → agent.generate → scorers →
 * persisted results and scores), but the model is a deterministic mock: no API key
 * is needed and every run is reproducible. Each "variant" mimics a different model
 * or prompt setup, so scores and outputs differ between experiments.
 *
 * Run from examples/agent while (or before) `mastra dev` is running:
 *   npx tsx src/seed-chef-compare.ts
 *
 * MASTRA_DB_URL defaults to the database the dev server uses (src/mastra/public/mastra.db).
 */
import path from 'node:path';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { LibSQLStore } from '@mastra/libsql';
import { alternatingScorer, alwaysPassScorer } from './mastra/scorers/chef-model-v2-scorers';

const DB_URL = process.env.MASTRA_DB_URL ?? `file:${path.resolve('src/mastra/public/mastra.db')}`;
const AGENT_ID = 'chef-model-v2-agent';

interface Item {
  prompt: string;
  ingredients: string[];
  dish: string;
}

const ITEMS: Item[] = [
  {
    prompt: 'I have eggs, spinach and feta. What can I cook for dinner?',
    ingredients: ['eggs', 'spinach', 'feta'],
    dish: 'a spinach and feta frittata',
  },
  {
    prompt: 'Only rice, chicken thighs and soy sauce left in the fridge. Ideas?',
    ingredients: ['rice', 'chicken', 'soy sauce'],
    dish: 'a soy-glazed chicken rice bowl',
  },
  {
    prompt: 'I have pasta, canned tomatoes, garlic and basil. Quick weeknight meal?',
    ingredients: ['pasta', 'tomatoes', 'garlic', 'basil'],
    dish: 'a garlicky tomato-basil pasta',
  },
  {
    prompt: 'Chickpeas, coconut milk and curry powder — can I make something vegan?',
    ingredients: ['chickpeas', 'coconut milk', 'curry powder'],
    dish: 'a coconut chickpea curry',
  },
  {
    prompt: 'Potatoes, leeks and butter. Something warm for a cold night?',
    ingredients: ['potatoes', 'leeks', 'butter'],
    dish: 'a creamy potato and leek soup',
  },
];

interface Variant {
  name: string;
  description: string;
  /** How many of the item's ingredients the answer mentions. */
  coverage: number;
  /** Adds filler sentences, which hurts conciseness. */
  verbose?: boolean;
  /** Index of an item the model fails on. */
  failsOn?: number;
}

const VARIANTS: Variant[] = [
  { name: 'Baseline (gpt-5-mini)', description: 'Default chef prompt.', coverage: 0.67 },
  { name: 'Prompt v2 (ingredient-first)', description: 'Asks the model to reuse every ingredient.', coverage: 1 },
  { name: 'Temperature 0', description: 'Deterministic sampling.', coverage: 0.67 },
  { name: 'Temperature 1.2', description: 'Creative sampling.', coverage: 0.34, verbose: true },
  { name: 'Few-shot recipes', description: 'Three worked examples in the prompt.', coverage: 1, verbose: true },
  { name: 'Chain of thought', description: 'Reasons before answering.', coverage: 1, verbose: true, failsOn: 3 },
  { name: 'Smaller model', description: 'Cheaper, smaller model.', coverage: 0.34 },
  { name: 'Larger model', description: 'Bigger, slower model.', coverage: 1 },
  { name: 'Short answers', description: 'Caps answers at two sentences.', coverage: 0.67 },
  { name: 'Tools disabled', description: 'No cooking tool available.', coverage: 0.34, failsOn: 1 },
];

function findItem(promptText: string): Item {
  return ITEMS.find(item => promptText.includes(item.prompt)) ?? ITEMS[0]!;
}

function answerFor(variant: Variant, item: Item): string {
  const used = item.ingredients.slice(0, Math.max(1, Math.round(item.ingredients.length * variant.coverage)));
  const answer = `## ${item.dish}\n\nUse what you have:\n\n${used.map(i => `- **${i}**`).join('\n')}\n\nSeason to taste and serve hot.`;
  if (!variant.verbose) return answer;
  return `${answer} Before you start, take a moment to read the whole recipe, set out your tools and preheat anything that needs heat. Cooking is about enjoying the process, so taste as you go and adjust the seasoning. Leftovers keep well in the fridge for a couple of days.`;
}

function lastUserText(prompt: unknown): string {
  const messages = Array.isArray(prompt) ? prompt : [];
  const user = [...messages].reverse().find(message => message?.role === 'user');
  if (!user) return '';
  const content: unknown = user.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(part => (part?.type === 'text' ? String(part.text) : '')).join(' ');
}

function createVariantModel(variant: Variant) {
  const respond = (prompt: unknown) => {
    const item = findItem(lastUserText(prompt));
    if (variant.failsOn !== undefined && ITEMS.indexOf(item) === variant.failsOn) {
      throw new Error('Model timed out after 30s');
    }
    return answerFor(variant, item);
  };
  const usage = (text: string) => ({ inputTokens: 40, outputTokens: text.split(' ').length, totalTokens: 40 + text.length });

  return new MastraLanguageModelV2Mock({
    provider: 'mock',
    modelId: `mock-${variant.name}`,
    doGenerate: async ({ prompt }) => {
      const text = respond(prompt);
      return {
        content: [{ type: 'text', text }],
        finishReason: 'stop',
        usage: usage(text),
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      const text = respond(prompt);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'response-metadata', id: 'r-0', modelId: 'mock', timestamp: new Date() });
            controller.enqueue({ type: 'text-start', id: 'text-0' });
            controller.enqueue({ type: 'text-delta', id: 'text-0', delta: text });
            controller.enqueue({ type: 'text-end', id: 'text-0' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: usage(text),
            });
            controller.close();
          },
        }),
      };
    },
  });
}

const ingredientCoverageScorer = createScorer({
  id: 'ingredient-coverage',
  name: 'Ingredient coverage',
  description: 'Share of the available ingredients the answer actually uses.',
})
  .generateScore(({ run }) => {
    const expected = (run.groundTruth as { ingredients?: string[] } | undefined)?.ingredients ?? [];
    if (expected.length === 0) return 0;
    const output = JSON.stringify(run.output).toLowerCase();
    return expected.filter(ingredient => output.includes(ingredient)).length / expected.length;
  })
  .generateReason(({ score }) => `The answer uses ${Math.round(score * 100)}% of the available ingredients.`);

const concisenessScorer = createScorer({
  id: 'conciseness',
  name: 'Conciseness',
  description: 'Full score at 30 words or fewer, decreasing as the answer grows.',
})
  .generateScore(({ run }) => {
    const words = JSON.stringify(run.output).split(/\s+/).length;
    return Math.max(0, Math.min(1, 30 / words));
  })
  .generateReason(({ score }) => (score >= 0.9 ? 'Short and to the point.' : 'The answer carries filler sentences.'));

async function main() {
  const storage = new LibSQLStore({ id: 'seed-chef-compare', url: DB_URL });
  const scorers = { alwaysPassScorer, alternatingScorer, ingredientCoverageScorer, concisenessScorer };

  const datasetMastra = new Mastra({ storage, scorers, logger: false });
  const dataset = await datasetMastra.datasets.create({
    name: 'Chef recipes (compare up to 10)',
    description: 'Pantry prompts for chef-model-v2-agent, seeded by src/seed-chef-compare.ts',
  });
  await dataset.addItems({
    items: ITEMS.map(item => ({
      input: item.prompt,
      groundTruth: { dish: item.dish, ingredients: item.ingredients },
    })),
  });
  console.log(`Dataset ${dataset.id} with ${ITEMS.length} items`);

  const experimentIds: string[] = [];
  for (const variant of VARIANTS) {
    // A dedicated Mastra per variant registers the chef agent id with that variant's mock model.
    const agent = new Agent({
      id: AGENT_ID,
      name: 'Chef Agent V2 Model',
      instructions: 'You are Michel, a practical home chef. Suggest a recipe using the ingredients the user has.',
      model: createVariantModel(variant),
    });
    const mastra = new Mastra({ storage, scorers, agents: { chefModelV2Agent: agent }, logger: false });
    const variantDataset = await mastra.datasets.get({ id: dataset.id });

    const summary = await variantDataset.startExperiment({
      name: variant.name,
      description: variant.description,
      targetType: 'agent',
      targetId: AGENT_ID,
      scorers: Object.values(scorers),
      maxConcurrency: 1,
    });
    experimentIds.push(summary.experimentId);
    console.log(
      `  ${variant.name.padEnd(30)} ${summary.experimentId}  ${summary.succeededCount} ok / ${summary.failedCount} failed`,
    );
  }

  const [baseline, ...contenders] = experimentIds;
  const params = new URLSearchParams({ dataset: dataset.id, baseline: baseline! });
  for (const id of contenders) params.append('contender', id);
  console.log(`\nCompare all ten: /experiments/compare?${params.toString()}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
