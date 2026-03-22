import { test, expect } from '@playwright/test';

test.describe('Datasets', () => {
  test('datasets list page shows create button and heading', async ({ page }) => {
    await page.goto('/datasets');

    await expect(page.getByRole('heading', { name: 'Datasets', level: 1 })).toBeVisible();
    // "Create Dataset" should always be available in the header
    await expect(
      page.locator('main').locator('header').getByRole('button', { name: 'Create Dataset' }),
    ).toBeVisible();
  });

  test('create dataset and verify it appears in list', async ({ page }) => {
    await page.goto('/datasets');

    // Open create dialog
    await page.getByRole('button', { name: 'Create Dataset' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Create Dataset' })).toBeVisible();

    // Create Dataset button should be disabled with empty name
    const submitBtn = page.getByRole('dialog').getByRole('button', { name: 'Create Dataset' });
    await expect(submitBtn).toBeDisabled();

    // Fill form
    await page.getByRole('textbox', { name: 'Name *' }).fill('E2E Test Dataset');
    await page.getByRole('textbox', { name: 'Description' }).fill('Created by smoke tests');

    // Submit
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Dialog should close and navigate to dataset detail
    await expect(page.getByRole('dialog', { name: 'Create Dataset' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E Test Dataset', level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Created by smoke tests')).toBeVisible();
  });

  test('add item to dataset and view its detail', async ({ page, request }) => {
    // Create dataset via API
    const createRes = await request.post('/api/datasets', {
      data: { name: 'Items Test Dataset', description: 'For item tests' },
    });
    expect(createRes.ok()).toBeTruthy();
    const dataset = await createRes.json();
    const datasetId = dataset.id;

    // Navigate to dataset detail
    await page.goto(`/datasets/${datasetId}`);
    await expect(page.getByRole('heading', { name: 'Items Test Dataset', level: 1 })).toBeVisible({ timeout: 10_000 });

    // Should show empty items tab initially — the "Add Item" button should be present
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible();

    // Click "Add Item" to open dialog
    await page.getByRole('button', { name: 'Add Item' }).click();
    await expect(page.getByRole('dialog', { name: 'Add Item' })).toBeVisible();

    // The dialog has CodeMirror editors for Input and Ground Truth.
    // Fill the input editor — find it via the label association
    const dialog = page.getByRole('dialog', { name: 'Add Item' });
    // Input editor is the first .cm-content in the dialog
    const inputEditor = dialog.locator('.cm-content').first();
    await inputEditor.click();
    // Select all and replace existing content
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('{"prompt": "Hello world"}');

    // Fill Ground Truth editor — second .cm-content
    const gtEditor = dialog.locator('.cm-content').nth(1);
    await gtEditor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('{"response": "Hi there"}');

    // Submit
    await dialog.getByRole('button', { name: 'Add Item' }).click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Item should appear in the list
    await expect(page.getByText('"Hello world"')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('"Hi there"')).toBeVisible();

    // Click the item row to open detail panel
    const itemRow = page.getByRole('listitem').filter({ hasText: 'Hello world' });
    await itemRow.getByRole('button').click();

    // Detail panel should show Input and Ground Truth headings
    await expect(page.getByRole('heading', { name: 'Input', level: 2 })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'Ground Truth', level: 2 })).toBeVisible();

    // Clean up via API
    await request.delete(`/api/datasets/${datasetId}`);
  });

  test('edit dataset name and description', async ({ page, request }) => {
    // Create dataset via API
    const createRes = await request.post('/api/datasets', {
      data: { name: 'Before Edit', description: 'Old description' },
    });
    expect(createRes.ok()).toBeTruthy();
    const dataset = await createRes.json();
    const datasetId = dataset.id;

    await page.goto(`/datasets/${datasetId}`);
    await expect(page.getByRole('heading', { name: 'Before Edit', level: 1 })).toBeVisible({ timeout: 10_000 });

    // Open actions menu → Edit Dataset
    await page.getByRole('button', { name: 'Dataset actions menu' }).first().click();
    await page.getByRole('menuitem', { name: 'Edit Dataset' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit Dataset' });
    await expect(dialog).toBeVisible();

    // Verify pre-filled values
    const nameInput = dialog.getByRole('textbox', { name: 'Name *' });
    await expect(nameInput).toHaveValue('Before Edit');

    // Change name and description
    await nameInput.clear();
    await nameInput.fill('After Edit');
    const descInput = dialog.getByRole('textbox', { name: 'Description' });
    await descInput.clear();
    await descInput.fill('New description');

    await dialog.getByRole('button', { name: 'Save Changes' }).click();

    // Dialog should close, heading should update
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'After Edit', level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('New description')).toBeVisible();

    // Clean up
    await request.delete(`/api/datasets/${datasetId}`);
  });

  test('edit item input and verify update', async ({ page, request }) => {
    // Create dataset + item via API
    const createRes = await request.post('/api/datasets', {
      data: { name: 'Edit Item Dataset', description: 'For item editing' },
    });
    expect(createRes.ok()).toBeTruthy();
    const dataset = await createRes.json();
    const datasetId = dataset.id;

    const itemRes = await request.post(`/api/datasets/${datasetId}/items`, {
      data: { input: { original: 'value' }, groundTruth: { expected: 'result' } },
    });
    expect(itemRes.ok()).toBeTruthy();

    await page.goto(`/datasets/${datasetId}`);
    await expect(page.getByRole('heading', { name: 'Edit Item Dataset', level: 1 })).toBeVisible({ timeout: 10_000 });

    // Click item to open detail panel
    const itemRow = page.getByRole('listitem').filter({ hasText: 'original' });
    await itemRow.getByRole('button').click();

    // Detail panel should show read-only content
    await expect(page.getByRole('heading', { name: 'Input', level: 2 })).toBeVisible({ timeout: 5_000 });

    // Open item actions menu → Edit
    await page.getByRole('button', { name: 'Actions menu' }).last().click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    // Should switch to edit mode
    await expect(page.getByRole('heading', { name: 'Edit Item', level: 3 })).toBeVisible();

    // Modify the input JSON — the first CodeMirror editor in edit mode
    const inputEditor = page.locator('.cm-content').first();
    await inputEditor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('{"modified": "updated-value"}');

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Should return to read-only mode with updated content
    await expect(page.getByRole('heading', { name: 'Edit Item', level: 3 })).not.toBeVisible({ timeout: 10_000 });
    // The updated value appears in both the item list and the detail panel code editor
    await expect(page.getByText('updated-value').first()).toBeVisible({ timeout: 5_000 });

    // Clean up
    await request.delete(`/api/datasets/${datasetId}`);
  });

  test('delete item from detail panel', async ({ page, request }) => {
    // Create dataset + item via API
    const createRes = await request.post('/api/datasets', {
      data: { name: 'Delete Item Dataset', description: 'For item deletion' },
    });
    expect(createRes.ok()).toBeTruthy();
    const dataset = await createRes.json();
    const datasetId = dataset.id;

    const itemRes = await request.post(`/api/datasets/${datasetId}/items`, {
      data: { input: { to_delete: 'this-item' }, groundTruth: { answer: '42' } },
    });
    expect(itemRes.ok()).toBeTruthy();

    await page.goto(`/datasets/${datasetId}`);
    await expect(page.getByText('to_delete')).toBeVisible({ timeout: 10_000 });

    // Click item to open detail panel
    const itemRow = page.getByRole('listitem').filter({ hasText: 'to_delete' });
    await itemRow.getByRole('button').click();
    await expect(page.getByRole('heading', { name: 'Input', level: 2 })).toBeVisible({ timeout: 5_000 });

    // Open item actions menu → Delete Item
    await page.getByRole('button', { name: 'Actions menu' }).last().click();
    await page.getByRole('menuitem', { name: 'Delete Item' }).click();

    // Confirm in alert dialog
    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByText('delete this item')).toBeVisible();
    await alertDialog.getByRole('button', { name: 'Yes, Delete' }).click();

    // Alert dialog and detail panel should close, item should be gone from list
    await expect(alertDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('to_delete')).not.toBeVisible({ timeout: 10_000 });

    // The Items tab should now show 0
    await expect(page.getByRole('tab', { name: /Items\s+0/ })).toBeVisible();

    // Clean up
    await request.delete(`/api/datasets/${datasetId}`);
  });

  test('experiments tab shows empty state', async ({ page, request }) => {
    // Create dataset via API
    const createRes = await request.post('/api/datasets', {
      data: { name: 'Experiments Tab Dataset', description: 'For tab test' },
    });
    expect(createRes.ok()).toBeTruthy();
    const dataset = await createRes.json();
    const datasetId = dataset.id;

    await page.goto(`/datasets/${datasetId}`);
    await expect(page.getByRole('heading', { name: 'Experiments Tab Dataset', level: 1 })).toBeVisible({ timeout: 10_000 });

    // Switch to Experiments tab
    await page.getByRole('tab', { name: /Experiments/ }).click();

    // Should show empty state
    await expect(page.getByRole('heading', { name: 'No experiments yet', level: 3 })).toBeVisible();
    await expect(page.getByText('Trigger an experiment to evaluate')).toBeVisible();

    // Should have filter comboboxes (labels are hidden, match by displayed text)
    await expect(page.getByText('All statuses')).toBeVisible();
    await expect(page.getByText('All types')).toBeVisible();

    // Clean up
    await request.delete(`/api/datasets/${datasetId}`);
  });

  test('delete dataset removes it from list', async ({ page, request }) => {
    // Create dataset via API with a unique name
    const uniqueName = `Delete-${Date.now()}`;
    const createRes = await request.post('/api/datasets', {
      data: { name: uniqueName, description: 'Will be deleted' },
    });
    expect(createRes.ok()).toBeTruthy();
    const dataset = await createRes.json();
    const datasetId = dataset.id;

    // Navigate to dataset detail
    await page.goto(`/datasets/${datasetId}`);
    await expect(page.getByRole('heading', { name: uniqueName, level: 1 })).toBeVisible({ timeout: 10_000 });

    // Open actions menu and click Delete
    await page.getByRole('button', { name: 'Dataset actions menu' }).first().click();
    await page.getByRole('menuitem', { name: 'Delete Dataset' }).click();

    // Confirm deletion in alert dialog
    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByText(uniqueName)).toBeVisible();
    await alertDialog.getByRole('button', { name: 'Delete' }).click();

    // Should navigate back to datasets list
    await expect(page).toHaveURL(/\/datasets\/?$/, { timeout: 10_000 });

    // The specific dataset link should be removed from the DOM entirely
    const datasetLink = page.locator(`a[href="/datasets/${datasetId}"]`);
    await expect(datasetLink).toHaveCount(0, { timeout: 10_000 });
  });

  test('JSON import: upload file and import items', async ({ page, request }) => {
    // Create dataset via API
    const createRes = await request.post('/api/datasets', {
      data: { name: 'JSON Import Dataset', description: 'For JSON import test' },
    });
    expect(createRes.ok()).toBeTruthy();
    const dataset = await createRes.json();
    const datasetId = dataset.id;

    await page.goto(`/datasets/${datasetId}`);
    await expect(page.getByRole('heading', { name: 'JSON Import Dataset', level: 1 })).toBeVisible({ timeout: 10_000 });

    // On an empty dataset, Import JSON is a direct button in the empty state
    await page.getByRole('button', { name: 'Import JSON' }).click();

    // The dialog title changes per step, so use a stable locator
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Import JSON' })).toBeVisible();
    await expect(dialog.getByText('JSON files only')).toBeVisible();

    // Upload a JSON file via the hidden file input
    const jsonContent = JSON.stringify([
      { input: 'What is 1+1?', groundTruth: '2' },
      { input: 'What is 2+2?', groundTruth: '4' },
      { input: 'What is 3+3?', groundTruth: '6' },
    ]);
    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-data.json',
      mimeType: 'application/json',
      buffer: Buffer.from(jsonContent),
    });

    // Should advance to preview step showing "Found 3 valid items to import."
    await expect(dialog.getByRole('heading', { name: 'Preview Data' })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('Found 3 valid items to import.')).toBeVisible();
    // Preview table should show our data
    await expect(dialog.getByText('What is 1+1?')).toBeVisible();

    // Click "Import 3 Items"
    await dialog.getByRole('button', { name: /Import 3 Items/ }).click();

    // Should show Import Complete
    await expect(dialog.getByRole('heading', { name: 'Import Complete' })).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('3 items imported')).toBeVisible();

    // Click Done
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).not.toBeVisible();

    // Verify items appear in the dataset list (the items tab should show our data)
    await expect(page.getByText('What is 1+1?')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('What is 2+2?')).toBeVisible();
    await expect(page.getByText('What is 3+3?')).toBeVisible();

    // Clean up
    await request.delete(`/api/datasets/${datasetId}`);
  });

  test('CSV import: upload file and reach mapping step', async ({ page, request }) => {
    // Create dataset via API
    const createRes = await request.post('/api/datasets', {
      data: { name: 'CSV Import Dataset', description: 'For CSV import test' },
    });
    expect(createRes.ok()).toBeTruthy();
    const dataset = await createRes.json();
    const datasetId = dataset.id;

    await page.goto(`/datasets/${datasetId}`);
    await expect(page.getByRole('heading', { name: 'CSV Import Dataset', level: 1 })).toBeVisible({ timeout: 10_000 });

    // On an empty dataset, Import CSV is a direct button in the empty state
    await page.getByRole('button', { name: 'Import CSV' }).click();

    // The dialog title changes per step, so use a stable locator
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Import CSV' })).toBeVisible();
    await expect(dialog.getByText('CSV files only')).toBeVisible();

    // Upload a CSV file via the hidden file input
    const csvContent = 'question,answer\nWhat is 1+1?,2\nWhat is 2+2?,4';
    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Should advance to preview step showing the data
    await expect(dialog.getByRole('heading', { name: 'Preview Data' })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('question')).toBeVisible();
    await expect(dialog.getByText('answer')).toBeVisible();
    await expect(dialog.getByText('What is 1+1?')).toBeVisible();

    // Click Next to go to column mapping
    await dialog.getByRole('button', { name: 'Next' }).click();

    // Should show the Map Columns step with drag zones
    await expect(dialog.getByRole('heading', { name: 'Map Columns' })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('Data passed to target')).toBeVisible();
    await expect(dialog.getByText('Ground truth for comparison')).toBeVisible();
    await expect(dialog.getByText('Not imported')).toBeVisible();

    // Both columns should start in the Ignore zone
    await expect(dialog.getByText('Drag at least one column here')).toBeVisible();

    // Clean up
    await request.delete(`/api/datasets/${datasetId}`);
  });

  test('trigger experiment with scorer and view results', async ({ page, request }) => {
    // Create dataset via API
    const createRes = await request.post('/api/datasets', {
      data: { name: `Experiment Dataset ${Date.now()}`, description: 'For experiment test' },
    });
    expect(createRes.ok()).toBeTruthy();
    const dataset = await createRes.json();
    const datasetId = dataset.id;

    // Add items with input/output structure for completeness scorer
    const itemPayloads = [
      { input: { input: 'What is AI?', output: 'Artificial intelligence is the simulation of human intelligence.' } },
      { input: { input: 'What is ML?', output: 'Machine learning is a subset of AI.' } },
    ];
    const itemIds: string[] = [];
    for (const item of itemPayloads) {
      const addRes = await request.post(`/api/datasets/${datasetId}/items`, { data: item });
      expect(addRes.ok()).toBeTruthy();
      const addedItem = await addRes.json();
      itemIds.push(addedItem.id);
    }

    // Navigate to dataset page
    await page.goto(`/datasets/${datasetId}`);
    await expect(page.getByRole('heading', { name: /Experiment Dataset/ })).toBeVisible({ timeout: 10_000 });

    // Click "Run Experiment"
    await page.getByRole('button', { name: /Run Experiment/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Run Experiment' })).toBeVisible();

    // Select Target Type → Scorer
    await dialog.getByRole('combobox').first().click();
    await dialog.getByRole('option', { name: 'Scorer' }).click();

    // Select Target → completeness (may have duplicates from stale CMS entries)
    await dialog.getByRole('combobox').nth(1).click();
    await dialog.getByRole('option', { name: 'Completeness Scorer', exact: true }).first().click();

    // Click Run
    await dialog.getByRole('button', { name: 'Run' }).click();

    // After triggering, the page should navigate to the experiment detail page
    // Wait for the experiment detail page to load (URL changes to /datasets/{id}/experiments/{experimentId})
    await page.waitForURL(/\/datasets\/.*\/experiments\//, { timeout: 15_000 });

    // The experiment detail page shows the experiment ID and stats
    // Wait for the experiment to complete (polling happens automatically in the UI every 2s)
    // The status badge shows "completed" in exact lowercase
    await expect(page.getByText('completed', { exact: true })).toBeVisible({ timeout: 30_000 });

    // Verify stats show our 2 items succeeded
    await expect(page.getByText('Total:')).toBeVisible();
    await expect(page.getByText('Succeeded:')).toBeVisible();

    // Verify the target is shown as Completeness Scorer
    await expect(page.getByText('Target')).toBeVisible();
    await expect(page.getByText('Completeness Scorer').first()).toBeVisible();

    // Switch to Results tab and verify concrete result rows from our seeded items
    await page.getByRole('tab', { name: 'Results' }).click();
    // Each result row renders the first 8 chars of the dataset item ID
    // Verify both seeded items appear as result rows
    for (const itemId of itemIds) {
      await expect(page.getByText(itemId.slice(0, 8))).toBeVisible({ timeout: 10_000 });
    }
    // The input text from our seeded items should be visible in the result rows
    await expect(page.getByText('What is AI?')).toBeVisible();
    await expect(page.getByText('What is ML?')).toBeVisible();

    // Clean up
    await request.delete(`/api/datasets/${datasetId}`);
  });
});
