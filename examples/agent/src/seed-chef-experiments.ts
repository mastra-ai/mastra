import { MastraClient } from '@mastra/client-js';

/**
 * Seeds datasets and runs real experiments against `chef-model-v2-agent`.
 *
 * Every experiment calls the agent and the LLM-judge scorers for real, so the
 * Studio shows genuine outputs, scores and reasons. Requires a running server
 * (`pnpm mastra dev`) with OPENAI_API_KEY set.
 *
 * Re-running is safe: scorers and datasets are reused by id/name, and each run
 * adds new experiments so you can compare them in the Studio.
 */

const baseUrl = process.env.MASTRA_URL ?? 'http://localhost:4111';
const AGENT_ID = 'chef-model-v2-agent';
const JUDGE_MODEL = { provider: 'openai', name: 'gpt-5-mini' };
const EXPERIMENT_RUNS = ['Baseline', 'Re-run'];
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

interface ScorerDef {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

interface DatasetDef {
  name: string;
  description: string;
  scorerIds: string[];
  items: { externalId: string; input: string; groundTruth: string }[];
}

const SCORERS: ScorerDef[] = [
  {
    id: 'chef-ingredient-adherence',
    name: 'Ingredient Adherence',
    description: 'Checks that the recipe only relies on the ingredients the user listed plus common pantry staples.',
    instructions: `You are a strict culinary reviewer. The user lists the ingredients they have.
Score 1 when the suggested recipe uses only those ingredients plus basic staples (salt, pepper, oil, butter, water, common dried spices).
Score 0.5 when it needs one non-staple ingredient that is clearly flagged as optional or offered with a substitution.
Score 0 when it requires ingredients the user did not mention without flagging them.`,
  },
  {
    id: 'chef-recipe-clarity',
    name: 'Recipe Clarity',
    description: 'Checks that the answer is an actionable recipe with quantities, ordered steps and timings.',
    instructions: `You review home-cooking answers for clarity.
A great answer (score close to 1) names the dish, gives quantities, lists numbered steps in cooking order, includes heat levels or temperatures and cooking times, and fits the user's time constraints if any.
Deduct for missing quantities, missing timings, vague steps ("cook until done") or ignoring the user's constraints. Score 0 when no usable recipe is given.`,
  },
  {
    id: 'chef-dietary-compliance',
    name: 'Dietary Compliance',
    description: 'Checks that the answer respects the dietary restriction or allergy stated by the user.',
    instructions: `You are a dietitian reviewing cooking advice.
Identify the dietary restriction or allergy in the user's message (vegan, gluten-free, nut allergy, dairy-free, low-sodium, etc.).
Score 1 when every suggested ingredient and substitution complies, 0.5 when compliance depends on an unflagged brand or label check (e.g. oats not labelled gluten-free), and 0 when any suggested ingredient violates the restriction.`,
  },
];

const DATASETS: DatasetDef[] = [
  {
    name: 'Chef V2 — Pantry Cooking',
    description: 'Real "what can I cook with what I have" requests used to evaluate the chef model v2 agent.',
    scorerIds: ['chef-ingredient-adherence', 'chef-recipe-clarity'],
    items: [
      {
        externalId: 'eggs-spinach-feta',
        input: 'I have 4 eggs, a bag of baby spinach, feta and half an onion. What can I cook tonight for two?',
        groundTruth:
          'A spinach and feta frittata or omelette: soften the onion in oil, wilt the spinach, pour in beaten eggs, crumble feta on top, cook on low heat then finish under the grill or covered.',
      },
      {
        externalId: 'leftover-rice',
        input: "I've got leftover cooked rice from yesterday, 2 eggs, frozen peas, soy sauce and a carrot. Ideas?",
        groundTruth:
          'Egg fried rice: stir-fry diced carrot, add peas, push aside to scramble the eggs, add the cold rice, season with soy sauce and toss on high heat for a few minutes.',
      },
      {
        externalId: 'chicken-thighs-lemon',
        input: 'I have 6 chicken thighs, 2 lemons, garlic, potatoes and dried rosemary. I want a one-tray dinner.',
        groundTruth:
          'Lemon-garlic roast chicken thighs with potatoes on one sheet pan at about 200°C / 400°F for 40–45 minutes, potatoes cut small, chicken skin-side up, seasoned with lemon, garlic and rosemary.',
      },
      {
        externalId: 'chickpeas-tomatoes',
        input: 'All I have is a can of chickpeas, a can of chopped tomatoes, an onion, cumin and some stale bread.',
        groundTruth:
          'A chickpea and tomato stew spiced with cumin, simmered 15–20 minutes, served with the stale bread toasted (or as croutons/dipping bread).',
      },
      {
        externalId: 'pasta-15-minutes',
        input: 'I need dinner in 15 minutes. I have spaghetti, garlic, olive oil, chili flakes and parmesan.',
        groundTruth:
          'Spaghetti aglio, olio e peperoncino: cook pasta, gently fry sliced garlic and chili in olive oil, toss with pasta and a splash of pasta water, finish with parmesan. Fits in 15 minutes.',
      },
      {
        externalId: 'overripe-bananas',
        input: 'I have 3 very ripe bananas, flour, sugar, butter, 1 egg and baking soda. What can I bake?',
        groundTruth:
          'Banana bread: mash bananas, mix with melted butter, sugar and the egg, fold in flour and baking soda, bake in a loaf tin around 175°C / 350°F for 55–65 minutes.',
      },
      {
        externalId: 'salmon-broccoli',
        input:
          'Two salmon fillets, a head of broccoli, honey, soy sauce and rice. Make it feel like a restaurant meal.',
        groundTruth:
          'Honey-soy glazed salmon (pan-seared or baked ~12 minutes at 200°C) with roasted or steamed broccoli and steamed rice, glaze reduced from honey and soy sauce.',
      },
      {
        externalId: 'mushrooms-no-oven',
        input: "I have mushrooms, cream, an onion and some pasta but my oven is broken. What's a good option?",
        groundTruth:
          'A stovetop creamy mushroom pasta: sauté onion and mushrooms until browned, add cream and reduce, toss with cooked pasta. No oven required.',
      },
    ],
  },
  {
    name: 'Chef V2 — Dietary Substitutions',
    description: 'Substitution and restriction-aware cooking questions for the chef model v2 agent.',
    scorerIds: ['chef-dietary-compliance', 'chef-recipe-clarity'],
    items: [
      {
        externalId: 'vegan-butter-cake',
        input: 'Give me a vegan substitute for butter and eggs in a basic vanilla sponge cake.',
        groundTruth:
          'Replace butter with neutral oil or vegan block butter, and eggs with a mix of plant milk and vinegar (or aquafaba / applesauce) plus extra baking powder. No dairy or eggs anywhere.',
      },
      {
        externalId: 'gluten-free-pancakes',
        input: 'My daughter is coeliac. How do I make fluffy pancakes for her this Sunday?',
        groundTruth:
          'Use a certified gluten-free flour blend (or oat flour from certified gluten-free oats), baking powder checked gluten-free, milk, egg and sugar; warn about cross-contamination.',
      },
      {
        externalId: 'nut-free-pesto',
        input: 'I want to make pesto but my guest has a severe tree nut allergy.',
        groundTruth:
          'Nut-free pesto using sunflower or pumpkin seeds (or no seeds) with basil, garlic, parmesan and olive oil; avoid pine nuts, which should be treated as a risk for tree-nut allergies.',
      },
      {
        externalId: 'dairy-free-carbonara',
        input: 'Can I make a carbonara that is completely dairy-free? I am lactose intolerant.',
        groundTruth:
          'Yes: eggs, guanciale or pancetta, pasta water and black pepper; skip parmesan/pecorino or use a dairy-free alternative or nutritional yeast. No cream or cheese.',
      },
      {
        externalId: 'low-sodium-soup',
        input: 'My doctor told me to cut down on salt. Suggest a flavorful vegetable soup that is low sodium.',
        groundTruth:
          'A vegetable soup built on homemade or no-salt-added stock, flavored with garlic, herbs, lemon, spices and aromatics instead of salt; avoid stock cubes, soy sauce and canned vegetables with added salt.',
      },
      {
        externalId: 'vegan-protein-mealprep',
        input: 'Help me meal-prep 5 vegan high-protein lunches for the week.',
        groundTruth:
          'Five plant-based lunches built around lentils, chickpeas, tofu, tempeh or edamame with grains and vegetables, with batch-cooking instructions and storage guidance. No animal products.',
      },
    ],
  },
];

const terminalStatuses = new Set(['completed', 'failed']);

async function main() {
  const client = new MastraClient({ baseUrl });

  const agents = await client.listAgents();
  if (!agents[AGENT_ID]) {
    throw new Error(`Agent "${AGENT_ID}" not found on ${baseUrl}. Start the example with \`pnpm mastra dev\`.`);
  }

  for (const scorer of SCORERS) {
    await ensureScorer(client, scorer);
  }

  // Experiments resolve dataset scorers from the in-memory registry, which only picks up
  // stored scorers once they've been listed through the API.
  const registered = await client.listScorers();
  for (const scorer of SCORERS) {
    if (!registered[scorer.id]?.isRegistered) {
      throw new Error(`Stored scorer ${scorer.id} exists but was not registered on the server`);
    }
  }

  const experiments: { datasetId: string; datasetName: string; experimentId: string; name: string }[] = [];

  for (const def of DATASETS) {
    const datasetId = await ensureDataset(client, def);

    // Runs on the same dataset are sequential so the in-process runner isn't saturated.
    for (const run of EXPERIMENT_RUNS) {
      const name = `${def.name} · ${run} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
      const { experimentId } = await client.triggerDatasetExperiment({
        datasetId,
        targetType: 'agent',
        targetId: AGENT_ID,
        name,
        description: `${run} run of ${AGENT_ID} against "${def.name}"`,
        maxConcurrency: 2,
      });
      console.log(`Started experiment ${experimentId} (${name})`);
      await waitForExperiment(client, datasetId, experimentId);
      experiments.push({ datasetId, datasetName: def.name, experimentId, name });
    }
  }

  console.log('\nSummary');
  for (const exp of experiments) {
    const [experiment, { scores }] = await Promise.all([
      getExperiment(client, exp.datasetId, exp.experimentId),
      client.listScoresByRunId({ runId: exp.experimentId, perPage: 200 }),
    ]);

    const byScorer = new Map<string, number[]>();
    for (const score of scores) {
      byScorer.set(score.scorerId, [...(byScorer.get(score.scorerId) ?? []), score.score]);
    }

    console.log(
      `\n${exp.name}\n  status: ${experiment.status} — ${experiment.succeededCount}/${experiment.totalItems} succeeded, ${experiment.failedCount} failed`,
    );
    console.table(
      [...byScorer.entries()].map(([scorerId, values]) => ({
        scorerId,
        scores: values.length,
        mean: Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(3)),
      })),
    );
  }
}

async function ensureScorer(client: MastraClient, def: ScorerDef) {
  try {
    await client.getStoredScorer(def.id).details();
    console.log(`Scorer ${def.id} already exists`);
    return;
  } catch {
    // Not found: create it below.
  }

  await client.createStoredScorer({
    id: def.id,
    name: def.name,
    description: def.description,
    type: 'llm-judge',
    model: JUDGE_MODEL,
    instructions: def.instructions,
    scoreRange: { min: 0, max: 1 },
    defaultSampling: { type: 'none' },
  });
  console.log(`Created scorer ${def.id}`);
}

async function ensureDataset(client: MastraClient, def: DatasetDef): Promise<string> {
  const { datasets } = await client.listDatasets({ perPage: 100 });
  const existing = datasets.find(dataset => dataset.name === def.name);
  if (existing) {
    console.log(`Dataset "${def.name}" already exists (${existing.id})`);
    return existing.id;
  }

  const dataset = await client.createDataset({
    name: def.name,
    description: def.description,
    targetType: 'agent',
    targetIds: [AGENT_ID],
    scorerIds: def.scorerIds,
  });
  await client.batchInsertDatasetItems({ datasetId: dataset.id, items: def.items });
  console.log(`Created dataset "${def.name}" (${dataset.id}) with ${def.items.length} items`);
  return dataset.id;
}

async function getExperiment(client: MastraClient, datasetId: string, experimentId: string) {
  const experiment = await client.getDatasetExperiment(datasetId, experimentId);
  if (!experiment) throw new Error(`Experiment ${experimentId} not found`);
  return experiment;
}

async function waitForExperiment(client: MastraClient, datasetId: string, experimentId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let experiment = await getExperiment(client, datasetId, experimentId);
  while (!terminalStatuses.has(experiment.status)) {
    if (Date.now() > deadline) {
      throw new Error(`Experiment ${experimentId} did not finish within ${POLL_TIMEOUT_MS / 60000} minutes`);
    }
    process.stdout.write(
      `\r  ${experiment.status}: ${experiment.succeededCount + experiment.failedCount}/${experiment.totalItems}`,
    );
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    experiment = await getExperiment(client, datasetId, experimentId);
  }
  process.stdout.write(`\r  ${experiment.status}: ${experiment.succeededCount}/${experiment.totalItems} succeeded\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
