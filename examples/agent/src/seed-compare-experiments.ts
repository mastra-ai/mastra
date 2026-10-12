/**
 * Seeds one dataset and three experiments with results and scores so the
 * Studio experiments comparison page has data. No LLM call is made: the
 * experiments are created without running and their results are submitted.
 *
 * Usage: npx tsx src/seed-compare-experiments.ts   (with `mastra dev` running)
 */

const API = `${process.env.MASTRA_URL ?? 'http://localhost:4111'}/api`;

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

const recipeSteps = Array.from({ length: 12 }, (_, i) => `${i + 1}. Step **${i + 1}**: stir and taste.`).join('\n');

const items = [
  {
    input: 'What can I cook with **eggs**, spinach and feta in under 15 minutes?',
    groundTruth: { dish: 'Spinach and feta omelette', maxMinutes: 15 },
  },
  {
    input: `# Fix my risotto\n\nI followed this recipe and it came out gluey:\n\n${recipeSteps}\n\nWhat went wrong?`,
    groundTruth: 'Too much stirring at high heat and adding all the stock at once.',
  },
  {
    input: 'Suggest a vegan dessert without nuts.',
    groundTruth: { dish: 'Chocolate avocado mousse', vegan: true, nutFree: true },
  },
  {
    input: 'How long should I rest a steak?',
    groundTruth: 'About 5 minutes, or half the cooking time.',
  },
];

const experiments = [
  {
    name: 'chef-agent gpt-4o-mini',
    quality: 0.55,
    outputs: [
      'Make an omelette.',
      'You probably used the wrong rice.',
      { dish: 'Fruit salad', vegan: true },
      'Rest it for a while.',
    ],
  },
  {
    name: 'chef-agent gpt-4o',
    quality: 0.8,
    outputs: [
      'A **spinach and feta omelette**: whisk 3 eggs, wilt the spinach, crumble the feta, fold. ~10 minutes.',
      `Risotto turns gluey when:\n\n- the heat is too high\n- all the stock goes in at once\n- it is over-stirred\n\n${recipeSteps}`,
      { dish: 'Chocolate avocado mousse', vegan: true, nutFree: true, minutes: 10 },
      'Rest it about **5 minutes** under foil.',
    ],
  },
  {
    name: 'chef-agent claude',
    quality: 0.7,
    outputs: [
      'Try a frittata with spinach and feta.',
      'Add the stock gradually and keep the heat at a gentle simmer.',
      { dish: 'Coconut panna cotta', vegan: true, nutFree: true },
      null,
    ],
  },
];

const jitter = (value: number) => Math.min(1, Math.max(0, Math.round((value + (Math.random() - 0.5) * 0.3) * 100) / 100));

async function main() {
  const dataset = await api<{ id: string }>('/datasets', {
    name: 'Chef comparison',
    description: 'Seeded for the experiments comparison page',
    targetType: 'agent',
    targetIds: ['chef-agent'],
    scorerIds: ['always-pass-scorer', 'alternating-scorer'],
  });
  const { items: created } = await api<{ items: { id: string; input: unknown; groundTruth?: unknown }[] }>(
    `/datasets/${dataset.id}/items/batch`,
    { items },
  );

  const experimentIds: string[] = [];
  for (const exp of experiments) {
    const { experimentId } = await api<{ experimentId: string }>(`/datasets/${dataset.id}/experiments`, {
      start: false,
      name: exp.name,
    });
    experimentIds.push(experimentId);

    for (const [index, item] of created.entries()) {
      const output = exp.outputs[index];
      const completedAt = new Date();
      const startedAt = new Date(completedAt.getTime() - (800 + Math.random() * 4000));
      await api(`/datasets/${dataset.id}/experiments/${experimentId}/results`, {
        itemId: item.id,
        input: item.input,
        groundTruth: item.groundTruth,
        output,
        error: output === null ? { message: 'Model timed out after 30s' } : null,
        startedAt,
        completedAt,
        scores:
          output === null
            ? []
            : [
                { scorerId: 'always-pass-scorer', score: 1, reason: 'Always passes.' },
                {
                  scorerId: 'answer-relevancy-scorer',
                  score: jitter(exp.quality),
                  reason: 'Relevancy against the question and the ground truth.',
                },
              ],
      });
    }
    await api(`/datasets/${dataset.id}/experiments/${experimentId}/finalize`, {});
    console.log(`experiment ${exp.name}: ${experimentId}`);
  }

  const [baseline, ...contenders] = experimentIds;
  const query = new URLSearchParams({ dataset: dataset.id, baseline });
  for (const id of contenders) query.append('contender', id);
  console.log(`\nOpen: /experiments/compare?${query}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
