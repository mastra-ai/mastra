/**
 * Test script that exercises every code example from the dataset guide docs.
 * Run: npx tsx src/test-dataset-docs.ts
 *
 * Uses chef-model-v2-agent (id: 'chef-model-v2-agent') and scorer1.
 */
import { mastra } from './mastra/index';

async function main() {
  console.log('=== overview.mdx: Accessing the datasets API ===');

  const datasets = mastra.datasets;

  // Create a dataset
  const dataset = await datasets.create({ name: 'my-dataset' });
  console.log('created dataset:', dataset.id);

  // Retrieve an existing dataset
  const existing = await datasets.get({ id: dataset.id });
  console.log('retrieved dataset:', existing.id);

  // List all datasets
  const { datasets: all } = await datasets.list();
  console.log('listed datasets:', all.length);

  // -----------------------------------------------------------------------
  console.log('\n=== overview.mdx: Creating a dataset (with schemas) ===');

  const { z } = await import('zod');

  const schemaDataset = await mastra.datasets.create({
    name: 'translation-pairs',
    inputSchema: z.object({
      text: z.string(),
      sourceLang: z.string(),
      targetLang: z.string(),
    }),
    groundTruthSchema: z.object({
      translation: z.string(),
    }),
  });
  console.log('schema dataset id:', schemaDataset.id);

  // -----------------------------------------------------------------------
  console.log('\n=== overview.mdx: Adding items ===');

  // Single item
  const item1 = await schemaDataset.addItem({
    input: { text: 'Hello', sourceLang: 'en', targetLang: 'es' },
    groundTruth: { translation: 'Hola' },
  });
  console.log('added single item:', item1.id);

  // Bulk insert
  const bulkItems = await schemaDataset.addItems({
    items: [
      {
        input: { text: 'Goodbye', sourceLang: 'en', targetLang: 'es' },
        groundTruth: { translation: 'Adiós' },
      },
      {
        input: { text: 'Thank you', sourceLang: 'en', targetLang: 'es' },
        groundTruth: { translation: 'Gracias' },
      },
    ],
  });
  console.log('added bulk items:', bulkItems.length);

  // -----------------------------------------------------------------------
  console.log('\n=== overview.mdx: Updating and deleting items ===');

  // Update an item
  await schemaDataset.updateItem({
    itemId: item1.id,
    groundTruth: { translation: '¡Hola!' },
  });
  console.log('updated item:', item1.id);

  // Delete a single item (use one of the bulk items)
  await schemaDataset.deleteItem({ itemId: bulkItems[0]!.id });
  console.log('deleted single item:', bulkItems[0]!.id);

  // Bulk delete
  await schemaDataset.deleteItems({ itemIds: [bulkItems[1]!.id] });
  console.log('deleted bulk items');

  // -----------------------------------------------------------------------
  console.log('\n=== overview.mdx: Listing and searching items ===');

  // Re-add items so we have data to list
  await schemaDataset.addItems({
    items: [
      {
        input: { text: 'Hello', sourceLang: 'en', targetLang: 'es' },
        groundTruth: { translation: 'Hola' },
      },
      {
        input: { text: 'Goodbye', sourceLang: 'en', targetLang: 'es' },
        groundTruth: { translation: 'Adiós' },
      },
    ],
  });

  // Paginated list
  const listResult = await schemaDataset.listItems({
    page: 0,
    perPage: 50,
  });
  // This returns { items, pagination } when no version
  if ('items' in listResult) {
    console.log('paginated items:', listResult.items.length, 'pagination:', listResult.pagination);
  }

  // Full-text search
  const searchResult = await schemaDataset.listItems({
    search: 'Hello',
  });
  if ('items' in searchResult) {
    console.log('search matches:', searchResult.items.length);
  }

  // -----------------------------------------------------------------------
  console.log('\n=== overview.mdx: Versioning ===');

  // Listing versions
  const { versions, pagination: vPagination } = await schemaDataset.listVersions();
  console.log('versions:', versions.length);
  for (const v of versions) {
    console.log(`Version ${v.version} — created ${v.createdAt}`);
  }

  // Viewing item history
  const history = await schemaDataset.getItemHistory({ itemId: item1.id });
  console.log('item history length:', history.length);
  for (const row of history) {
    console.log(`Version ${row.datasetVersion}`, row.input, row.groundTruth);
  }

  // List items at a specific version
  if (versions.length > 0) {
    const v2Items = await schemaDataset.listItems({ version: versions[0]!.version });
    // When version is specified, getItemsByVersion returns DatasetItem[]
    console.log('items at version:', Array.isArray(v2Items) ? v2Items.length : (v2Items as any).items.length);
  }

  // -----------------------------------------------------------------------
  console.log('\n=== running-experiments.mdx: Basic experiment ===');

  // Create a simple no-schema dataset for experiment tests
  const expDataset = await mastra.datasets.create({
    name: 'experiment-test-data',
  });

  await expDataset.addItems({
    items: [
      { input: 'What can I cook with eggs and cheese?' },
      { input: 'How do I make a simple salad?' },
    ],
  });

  const summary = await expDataset.startExperiment({
    name: 'chef-v2-baseline',
    targetType: 'agent',
    targetId: 'chef-model-v2-agent',
    scorers: ['scorer1'],
  });

  console.log('status:', summary.status);
  console.log('succeededCount:', summary.succeededCount);
  console.log('failedCount:', summary.failedCount);

  // -----------------------------------------------------------------------
  console.log('\n=== running-experiments.mdx: Scoring results ===');

  for (const item of summary.results) {
    console.log(item.itemId, typeof item.output === 'string' ? item.output.slice(0, 60) : item.output);
    for (const score of item.scores) {
      console.log(`  ${score.scorerName}: ${score.score} — ${score.reason}`);
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n=== running-experiments.mdx: Async experiments ===');

  const { experimentId, status } = await expDataset.startExperimentAsync({
    name: 'large-dataset-run',
    targetType: 'agent',
    targetId: 'chef-model-v2-agent',
    scorers: ['scorer1'],
  });

  console.log('experimentId:', experimentId);
  console.log('status:', status); // 'pending'

  // Poll for completion
  let experiment = await expDataset.getExperiment({ experimentId });
  console.log('initial poll status:', experiment?.status);

  // Wait a bit then check again
  await new Promise(resolve => setTimeout(resolve, 2000));
  experiment = await expDataset.getExperiment({ experimentId });
  console.log('poll status after 2s:', experiment?.status);

  // -----------------------------------------------------------------------
  console.log('\n=== running-experiments.mdx: Configuration options ===');

  // Concurrency
  const concurrencySummary = await expDataset.startExperiment({
    targetType: 'agent',
    targetId: 'chef-model-v2-agent',
    maxConcurrency: 10,
  });
  console.log('concurrency test status:', concurrencySummary.status);

  // Timeouts and retries
  const retrysSummary = await expDataset.startExperiment({
    targetType: 'agent',
    targetId: 'chef-model-v2-agent',
    itemTimeout: 30_000,
    maxRetries: 2,
  });
  console.log('timeout+retry test status:', retrysSummary.status);

  // Abort signal
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 60_000);

  const abortSummary = await expDataset.startExperiment({
    targetType: 'agent',
    targetId: 'chef-model-v2-agent',
    signal: controller.signal,
  });
  console.log('abort test status:', abortSummary.status);

  // -----------------------------------------------------------------------
  console.log('\n=== running-experiments.mdx: Viewing results ===');

  // Listing experiments
  const { experiments, pagination } = await expDataset.listExperiments({
    page: 0,
    perPage: 10,
  });

  for (const exp of experiments) {
    console.log(`${exp.name} — ${exp.status} (${exp.succeededCount}/${exp.totalItems})`);
  }

  // Experiment details
  if (experiments.length > 0) {
    const expDetail = await expDataset.getExperiment({
      experimentId: experiments[0]!.id,
    });
    console.log('detail status:', expDetail?.status);
    console.log('detail startedAt:', expDetail?.startedAt);
    console.log('detail completedAt:', expDetail?.completedAt);
  }

  // Item-level results
  if (experiments.length > 0) {
    const { results, pagination: rPagination } = await expDataset.listExperimentResults({
      experimentId: experiments[0]!.id,
      page: 0,
      perPage: 50,
    });

    for (const result of results) {
      console.log(result.itemId, result.output, result.error);
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n=== running-experiments.mdx: Pinning a dataset version ===');

  const details = await expDataset.getDetails();
  if (details.version > 0) {
    const pinnedSummary = await expDataset.startExperiment({
      targetType: 'agent',
      targetId: 'chef-model-v2-agent',
      version: details.version,
    });
    console.log('pinned version test status:', pinnedSummary.status);
  }

  // -----------------------------------------------------------------------
  console.log('\n=== Cleanup ===');

  await mastra.datasets.delete({ id: dataset.id });
  await mastra.datasets.delete({ id: schemaDataset.id });
  await mastra.datasets.delete({ id: expDataset.id });
  console.log('cleaned up all datasets');

  console.log('\n✅ All doc examples passed!');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
