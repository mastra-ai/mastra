import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__';

const PORT = process.env.E2E_PORT || '4111';
const BASE_URL = `http://localhost:${PORT}`;

async function seedDatasetWithExperiments() {
  const datasetResponse = await fetch(`${BASE_URL}/api/datasets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E Compare Dataset',
      description: 'Validates selecting experiments for comparison from the dataset page.',
    }),
  });

  if (!datasetResponse.ok) {
    throw new Error(`Failed to create dataset: ${datasetResponse.status} ${datasetResponse.statusText}`);
  }

  const dataset = (await datasetResponse.json()) as { id: string };

  const itemsResponse = await fetch(`${BASE_URL}/api/datasets/${dataset.id}/items/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [
        { input: 'What is the weather in Tokyo?', groundTruth: 'Sunny' },
        { input: 'What is the weather in London?', groundTruth: 'Cloudy' },
      ],
    }),
  });

  if (!itemsResponse.ok) {
    throw new Error(`Failed to add dataset items: ${itemsResponse.status} ${itemsResponse.statusText}`);
  }

  const experimentIds: string[] = [];

  for (let i = 0; i < 2; i++) {
    const experimentResponse = await fetch(`${BASE_URL}/api/datasets/${dataset.id}/experiments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        targetType: 'agent',
        targetId: 'weather-agent',
        scorerIds: ['response-quality'],
      }),
    });

    if (!experimentResponse.ok) {
      throw new Error(
        `Failed to create experiment ${i + 1}: ${experimentResponse.status} ${experimentResponse.statusText}`,
      );
    }

    const experiment = (await experimentResponse.json()) as { experimentId: string };
    experimentIds.push(experiment.experimentId);
  }

  return {
    datasetId: dataset.id,
    experimentIds: [experimentIds[0], experimentIds[1]] as const,
  };
}

test.afterEach(async () => {
  await resetStorage();
});

/**
 * FEATURE: Dataset experiment comparison
 * USER STORY: As a user, I want to select two experiments from a dataset so I can compare their results.
 * BEHAVIOR UNDER TEST: Selecting compare checkboxes must keep me on the dataset page until I explicitly trigger comparison,
 * then navigate to the comparison view with both experiment IDs encoded in the URL.
 */
test('dataset experiments compare mode keeps checkbox selection on-page and opens comparison view', async ({
  page,
}) => {
  const { datasetId, experimentIds } = await seedDatasetWithExperiments();
  const [baselineId, contenderId] = experimentIds;

  await page.goto(`/datasets/${datasetId}?tab=experiments`);

  await expect(page.getByText('weather-agent')).toHaveCount(2);

  await page.getByRole('button', { name: 'Compare' }).click();

  const baselineCheckbox = page.getByRole('checkbox', { name: `Select experiment ${baselineId}` });
  const contenderCheckbox = page.getByRole('checkbox', { name: `Select experiment ${contenderId}` });
  const compareButton = page.getByRole('button', { name: 'Compare Experiments' });

  await baselineCheckbox.click();
  await expect(page).toHaveURL(`${BASE_URL}/datasets/${datasetId}?tab=experiments`);
  await expect(baselineCheckbox).toBeChecked();
  await expect(compareButton).toBeDisabled();

  await contenderCheckbox.click();
  await expect(contenderCheckbox).toBeChecked();
  await expect(compareButton).toBeEnabled();

  await compareButton.click();

  await expect(page).toHaveURL(
    `${BASE_URL}/datasets/${datasetId}/experiments?baseline=${baselineId}&contender=${contenderId}`,
  );
  await expect(page.getByText('Dataset Experiments Comparison')).toBeVisible();
});
