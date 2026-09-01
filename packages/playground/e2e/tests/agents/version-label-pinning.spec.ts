import { writeFile } from 'node:fs/promises';

import type {
  AgentVersionLabel,
  CreateStoredAgentParams,
  ListAgentVersionLabelsResponse,
  ListAgentVersionsResponse,
  UpdateStoredAgentParams,
} from '@mastra/client-js';
import { expect, test } from '@playwright/test';
import type { APIRequestContext, APIResponse, Page, TestInfo } from '@playwright/test';

const VERSION_LABELS_BASE_URL = 'http://localhost:4112';
const AGENT_ID = 'version-label-pinning-agent';
const CUSTOM_LABEL = 'pr-101';
const VERSION_ONE_INSTRUCTIONS = 'E2E_VERSION_ONE Ask the user before completing the pinned run.';
const VERSION_TWO_INSTRUCTIONS = 'E2E_VERSION_TWO Ask the user before completing the pinned run.';
const VERSION_THREE_INSTRUCTIONS = 'E2E_VERSION_THREE Reserved for the stale compare-and-swap browser proof.';

test.use({ baseURL: VERSION_LABELS_BASE_URL, viewport: { width: 1440, height: 1000 } });

async function expectSuccessfulResponse(response: APIResponse) {
  if (!response.ok()) {
    throw new Error(`${response.url()} returned ${response.status()}: ${await response.text()}`);
  }
}

async function resetVersionLabelStorage(request: APIRequestContext) {
  const response = await request.post('/e2e/reset-version-label-storage');
  await expectSuccessfulResponse(response);
}

async function seedVersionHistory(request: APIRequestContext) {
  const createInput = {
    id: AGENT_ID,
    name: 'Version Label Pinning Agent',
    instructions: VERSION_ONE_INSTRUCTIONS,
    model: { provider: 'openai', name: 'gpt-4o-mini' },
    autoPublish: true,
  } satisfies CreateStoredAgentParams;
  const createResponse = await request.post('/api/stored/agents', { data: createInput });
  await expectSuccessfulResponse(createResponse);

  const updateInput = {
    instructions: VERSION_TWO_INSTRUCTIONS,
    changeMessage: 'Version two',
  } satisfies UpdateStoredAgentParams;
  const updateResponse = await request.patch(`/api/stored/agents/${AGENT_ID}`, { data: updateInput });
  await expectSuccessfulResponse(updateResponse);

  const thirdVersionInput = {
    instructions: VERSION_THREE_INSTRUCTIONS,
    changeMessage: 'Version three',
  } satisfies UpdateStoredAgentParams;
  const thirdVersionResponse = await request.patch(`/api/stored/agents/${AGENT_ID}`, { data: thirdVersionInput });
  await expectSuccessfulResponse(thirdVersionResponse);

  const versionsResponse = await request.get(`/api/stored/agents/${AGENT_ID}/versions`, {
    params: {
      page: 0,
      perPage: 20,
      'orderBy[field]': 'versionNumber',
      'orderBy[direction]': 'ASC',
    },
  });
  await expectSuccessfulResponse(versionsResponse);
  const history: ListAgentVersionsResponse = await versionsResponse.json();
  const versionOne = history.versions.find(version => version.versionNumber === 1);
  const versionTwo = history.versions.find(version => version.versionNumber === 2);
  const versionThree = history.versions.find(version => version.versionNumber === 3);

  expect(versionOne, 'seeded history should contain v1').toBeDefined();
  expect(versionTwo, 'seeded history should contain v2').toBeDefined();
  expect(versionThree, 'seeded history should contain v3').toBeDefined();
  if (!versionOne || !versionTwo || !versionThree) throw new Error('Version-label E2E history was not seeded');

  return { versionOne, versionTwo, versionThree };
}

async function listLabels(request: APIRequestContext): Promise<ListAgentVersionLabelsResponse> {
  const response = await request.get(`/api/stored/agents/${AGENT_ID}/labels`);
  await expectSuccessfulResponse(response);
  return response.json();
}

async function expectCustomLabelTarget(request: APIRequestContext, versionId: string | undefined) {
  await expect
    .poll(async () => {
      const labels = await listLabels(request);
      return labels.labels.find(label => label.name === CUSTOM_LABEL)?.versionId;
    })
    .toBe(versionId);
}

async function chooseOption(page: Page, triggerName: string, optionName: string) {
  await page.getByLabel(triggerName, { exact: true }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function chooseRunTargetOption(page: Page, optionName: string) {
  const trigger = page.getByLabel('Run target', { exact: true });
  await trigger.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  const option = listbox.getByText(optionName, { exact: true });
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  await expect(trigger).toContainText(optionName);
  await expect(trigger).not.toContainText('unavailable');
}

async function submitLabelMutation(page: Page, method: 'DELETE' | 'PUT', action: () => Promise<void>) {
  const responsePromise = page.waitForResponse(
    response =>
      response.request().method() === method &&
      response.url().includes(`/api/stored/agents/${AGENT_ID}/labels/${CUSTOM_LABEL}`),
    { timeout: 20_000 },
  );
  await action();
  await expectSuccessfulResponse(await responsePromise);
}

async function refetchLabelsOnTabFocus(page: Page) {
  const responsePromise = page.waitForResponse(
    response =>
      response.request().method() === 'GET' && response.url().includes(`/api/stored/agents/${AGENT_ID}/labels`),
    { timeout: 10_000 },
  );
  await page.bringToFront();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const response = await responsePromise;
  await expectSuccessfulResponse(response);
}

async function captureResponsiveArtifacts(page: Page, testInfo: TestInfo, surface: 'label-manager' | 'playground') {
  const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 1024, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    // Crossing the mobile breakpoint intentionally remounts the ephemeral
    // playground chat. Exercise the already reselected v2 target once more so
    // the mobile artifact captures the run surface instead of an empty chat.
    if (surface === 'playground' && viewport.name === 'mobile') {
      const composer = page.getByPlaceholder('Enter your message...');
      await expect(composer).toBeEnabled();
      await composer.fill('Capture the reselected release run on mobile.');
      await composer.press('Enter');
      await expect(page.getByText('Which runtime should complete this pinned run?')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('radio', { name: /TypeScript/, disabled: false }).click();
      await expect(page.getByText('Pinned execution completed with version two.')).toBeVisible();

      const composerBox = page.locator('[data-slot="composer-box"]');
      const currentRun = page.getByRole('status').filter({ hasText: 'Current run' });
      const currentRunBadge = currentRun.locator('[title]').first();
      const currentRunCopy = currentRun.getByRole('button', { name: /Copy resolved version ID for current run/ });
      const [composerBounds, currentRunBounds, badgeBounds, copyBounds] = await Promise.all([
        composerBox.boundingBox(),
        currentRun.boundingBox(),
        currentRunBadge.boundingBox(),
        currentRunCopy.boundingBox(),
      ]);
      if (!composerBounds || !currentRunBounds || !badgeBounds || !copyBounds) {
        throw new Error('Mobile run identity bounds could not be measured');
      }
      const rightEdge = (bounds: { x: number; width: number }) => bounds.x + bounds.width;
      const mobileBounds = {
        viewport: { left: 0, right: viewport.width, width: viewport.width },
        composer: { ...composerBounds, right: rightEdge(composerBounds) },
        currentRun: { ...currentRunBounds, right: rightEdge(currentRunBounds) },
        badge: { ...badgeBounds, right: rightEdge(badgeBounds) },
        copy: { ...copyBounds, right: rightEdge(copyBounds) },
      };
      expect(mobileBounds.composer.right).toBeLessThanOrEqual(mobileBounds.viewport.right + 1);
      for (const [name, bounds] of Object.entries({
        currentRun: mobileBounds.currentRun,
        badge: mobileBounds.badge,
        copy: mobileBounds.copy,
      })) {
        expect(bounds.right, `${name} should remain inside the mobile composer`).toBeLessThanOrEqual(
          mobileBounds.composer.right + 1,
        );
        expect(bounds.right, `${name} should remain inside the mobile viewport`).toBeLessThanOrEqual(
          mobileBounds.viewport.right + 1,
        );
      }
      const boundsPath = testInfo.outputPath('agent-version-labels-playground-mobile-bounds.json');
      await writeFile(boundsPath, `${JSON.stringify(mobileBounds, null, 2)}\n`);
      await testInfo.attach('agent-version-labels-playground-mobile-bounds', {
        path: boundsPath,
        contentType: 'application/json',
      });
    }

    const viewportFit = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(
      viewportFit.documentWidth,
      `${surface} should not overflow horizontally at ${viewport.name}`,
    ).toBeLessThanOrEqual(viewportFit.viewportWidth);
    const path = testInfo.outputPath(`agent-version-labels-${surface}-${viewport.name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(`agent-version-labels-${surface}-${viewport.name}`, { path, contentType: 'image/png' });
  }
}

async function chooseRecreatedReleaseLabel(page: Page) {
  const trigger = page.getByLabel('Run target', { exact: true });
  await trigger.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible({ timeout: 10_000 });

  const optionState = await listbox.locator('[role="option"]').evaluateAll(options =>
    options.map(option => ({
      text: option.textContent?.replace(/\s+/g, ' ').trim(),
      ariaDisabled: option.getAttribute('aria-disabled'),
      ariaSelected: option.getAttribute('aria-selected'),
      dataDisabled: option.hasAttribute('data-disabled'),
      dataValue: option.getAttribute('data-value'),
    })),
  );
  const recreatedOption = listbox.getByRole('option', { name: `${CUSTOM_LABEL} · v2`, exact: true });
  if ((await recreatedOption.count()) === 0) {
    throw new Error(`Recreated label is absent from the open run-target listbox: ${JSON.stringify(optionState)}`);
  }

  await recreatedOption.click();
  const selectedText = (await trigger.textContent())?.replace(/\s+/g, ' ').trim();
  if (!selectedText?.includes(`${CUSTOM_LABEL} · v2`)) {
    throw new Error(`Reselection chose ${JSON.stringify(selectedText)} from ${JSON.stringify(optionState)}`);
  }
  await expect(trigger).not.toContainText('unavailable');
}

test.describe('Agent version-label run pinning', () => {
  test.describe('when a selected custom label is moved, deleted, and recreated during a suspended run', () => {
    test('keeps the current run pinned and requires explicit reselection for the next run', async ({
      context,
      page: managementPage,
      request,
    }, testInfo) => {
      test.setTimeout(120_000);
      await resetVersionLabelStorage(request);
      const { versionOne, versionTwo, versionThree } = await seedVersionHistory(request);

      // A release manager creates the movable pointer through Studio. The
      // nested dialog must return keyboard focus before the pointer is saved.
      await managementPage.goto(`/cms/agents/${AGENT_ID}/edit/instruction-blocks`);
      await managementPage.getByRole('button', { name: 'Manage labels' }).click();
      const manager = managementPage.getByRole('dialog', { name: 'Manage version labels' });
      const createTrigger = manager.getByRole('button', { name: 'Create custom label' });
      await createTrigger.click();
      const createDialog = managementPage.getByRole('dialog', { name: 'Create custom label' });
      await expect(createDialog.getByLabel('Label name')).toBeFocused();
      await managementPage.keyboard.press('Escape');
      await expect(createTrigger).toBeFocused();

      // Reopen and complete the operation using only the keyboard.
      await managementPage.keyboard.press('Enter');
      await expect(createDialog.getByLabel('Label name')).toBeFocused();
      await managementPage.keyboard.type(CUSTOM_LABEL);
      await managementPage.keyboard.press('Tab');
      const createTarget = createDialog.getByLabel('Target version', { exact: true });
      await expect(createTarget).toBeFocused();
      await managementPage.keyboard.press('Enter');
      const createTargetListbox = managementPage.getByRole('listbox');
      await expect(createTargetListbox).toBeVisible();
      await managementPage.keyboard.press('End');
      await managementPage.keyboard.press('Enter');
      await expect(createTargetListbox).toBeHidden();
      await expect(createTarget).toContainText('v1 · Initial version');
      await expect(createTarget).toBeFocused();
      await managementPage.keyboard.press('Tab');
      await expect(createDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await managementPage.keyboard.press('Tab');
      const createSubmit = createDialog.getByRole('button', { name: `Create ${CUSTOM_LABEL} for v1` });
      await expect(createSubmit).toBeFocused();
      await submitLabelMutation(managementPage, 'PUT', () => managementPage.keyboard.press('Enter'));
      await expect(createDialog).toBeHidden();
      await expectCustomLabelTarget(request, versionOne.id);

      const labelsAtVersionOne = await listLabels(request);
      const labelAtVersionOne = labelsAtVersionOne.labels.find(label => label.name === CUSTOM_LABEL);
      expect(labelAtVersionOne?.revisionToken, 'the v1 label should expose a CAS revision token').toBeTruthy();
      if (!labelAtVersionOne?.revisionToken) throw new Error('The v1 label has no CAS revision token');

      // A second manager opens a v1 move intent before the first manager changes
      // the pointer. Its later submit must use the stale v1 revision exactly once.
      const staleManagementPage = await context.newPage();
      await staleManagementPage.goto(`/cms/agents/${AGENT_ID}/edit/instruction-blocks`);
      await staleManagementPage.getByRole('button', { name: 'Manage labels' }).click();
      const staleManager = staleManagementPage.getByRole('dialog', { name: 'Manage version labels' });
      const staleLabelRow = staleManager
        .getByRole('list', { name: 'Agent version labels' })
        .getByRole('listitem')
        .filter({ hasText: CUSTOM_LABEL });
      await staleLabelRow.getByRole('button', { name: `Move ${CUSTOM_LABEL} from v1` }).click();
      const staleMoveDialog = staleManagementPage.getByRole('dialog', { name: `Move ${CUSTOM_LABEL}` });
      await chooseOption(staleManagementPage, 'Target version', 'v3 · Version three');

      let staleMoveRequestCount = 0;
      staleManagementPage.on('request', request => {
        if (
          request.method() === 'PUT' &&
          request.url().includes(`/api/stored/agents/${AGENT_ID}/labels/${CUSTOM_LABEL}`)
        ) {
          staleMoveRequestCount += 1;
        }
      });

      // A developer selects the label, starts a real server stream, and leaves
      // the deterministic ask_user tool suspended. The resolved-version stream
      // chunk persisted by the chat layer is the trusted source for the pinned run.
      const runPage = await context.newPage();
      const subscriptionReady = runPage.waitForResponse(
        response =>
          response.request().method() === 'POST' &&
          response.url().includes(`/api/agents/${AGENT_ID}/threads/subscribe`),
        { timeout: 20_000 },
      );
      await runPage.goto(`/agents/${AGENT_ID}/editor`);
      await expectSuccessfulResponse(await subscriptionReady);
      await chooseRunTargetOption(runPage, `${CUSTOM_LABEL} · v1`);
      const runTarget = runPage.getByLabel('Run target', { exact: true });
      const composer = runPage.getByPlaceholder('Enter your message...');
      await composer.fill('Start the pinned release run.');
      await composer.press('Enter');
      await expect(runPage.getByText('Which runtime should complete this pinned run?')).toBeVisible({
        timeout: 15_000,
      });
      const currentRunStatus = runPage.getByRole('status').filter({ hasText: 'Current run' });
      await expect(currentRunStatus).toContainText(`${CUSTOM_LABEL} · v1`);

      // While that run is suspended, another tab moves the durable label to v2.
      // The selector follows the pointer for future work, but the trusted current
      // run identity must continue to show the immutable v1 resolution.
      await managementPage.bringToFront();
      const labelRow = manager
        .getByRole('list', { name: 'Agent version labels' })
        .getByRole('listitem')
        .filter({ hasText: CUSTOM_LABEL });
      await labelRow.getByRole('button', { name: `Move ${CUSTOM_LABEL} from v1` }).click();
      const moveDialog = managementPage.getByRole('dialog', { name: `Move ${CUSTOM_LABEL}` });
      await chooseOption(managementPage, 'Target version', 'v2 · Version two');
      await submitLabelMutation(managementPage, 'PUT', () =>
        moveDialog.getByRole('button', { name: `Move ${CUSTOM_LABEL} from v1 to v2` }).click(),
      );
      await expect(moveDialog).toBeHidden();
      await expectCustomLabelTarget(request, versionTwo.id);

      const staleConflictPromise = staleManagementPage.waitForResponse(
        response =>
          response.request().method() === 'PUT' &&
          response.url().includes(`/api/stored/agents/${AGENT_ID}/labels/${CUSTOM_LABEL}`),
        { timeout: 20_000 },
      );
      await staleMoveDialog.getByRole('button', { name: `Move ${CUSTOM_LABEL} from v1 to v3` }).click();
      const staleConflict = await staleConflictPromise;
      expect(staleConflict.status()).toBe(409);
      expect(staleConflict.request().postDataJSON()).toEqual({
        versionId: versionThree.id,
        expectedRevisionToken: labelAtVersionOne.revisionToken,
      });
      await expect(
        staleMoveDialog.getByText(/The label changed while this dialog was open\. It now targets v2\./),
      ).toBeVisible();
      const reviewCurrentState = staleMoveDialog.getByRole('button', {
        name: `Review current state for ${CUSTOM_LABEL} at v2`,
      });
      const blockedStaleRetry = staleMoveDialog.getByRole('button', {
        name: `Try moving ${CUSTOM_LABEL} from v2 to v3`,
      });
      await expect(reviewCurrentState).toBeEnabled();
      await expect(blockedStaleRetry).toBeDisabled();
      expect(staleMoveRequestCount).toBe(1);
      await reviewCurrentState.click();
      await expect(reviewCurrentState).toHaveText('Current state reviewed');
      await expect(blockedStaleRetry).toBeEnabled();
      expect(staleMoveRequestCount).toBe(1);
      await staleManagementPage.close();

      await refetchLabelsOnTabFocus(runPage);
      await expect(currentRunStatus).toContainText(`${CUSTOM_LABEL} · v1`);

      // Deletion must fail closed in the run tab. Recreating the same spelling
      // at v2 cannot silently revive the prior selection because that would let
      // a future run target a different immutable version without user consent.
      await managementPage.bringToFront();
      await labelRow.getByRole('button', { name: `Delete ${CUSTOM_LABEL} from v2` }).click();
      const deleteDialog = managementPage.getByRole('dialog', { name: `Delete ${CUSTOM_LABEL}?` });
      await submitLabelMutation(managementPage, 'DELETE', () =>
        deleteDialog.getByRole('button', { name: `Delete ${CUSTOM_LABEL} from v2` }).click(),
      );
      await expect(deleteDialog).toBeHidden();
      await expectCustomLabelTarget(request, undefined);
      await refetchLabelsOnTabFocus(runPage);
      await expect(
        runPage.getByText('This run target is no longer available. Choose another target before running.'),
      ).toBeVisible();

      await managementPage.bringToFront();
      await createTrigger.click();
      await createDialog.getByLabel('Label name').fill(CUSTOM_LABEL);
      await chooseOption(managementPage, 'Target version', 'v2 · Version two');
      await submitLabelMutation(managementPage, 'PUT', () =>
        createDialog.getByRole('button', { name: `Create ${CUSTOM_LABEL} for v2` }).click(),
      );
      await expect(createDialog).toBeHidden();
      await expectCustomLabelTarget(request, versionTwo.id);
      await refetchLabelsOnTabFocus(runPage);
      await expect(
        runPage.getByText('This run target is no longer available. Choose another target before running.'),
      ).toBeVisible();
      await expect(runTarget).toContainText(`${CUSTOM_LABEL} · v2 · unavailable`);

      // Continuation uses the known run ID, not the deleted/recreated selector.
      // Its v1 instruction marker controls the deterministic response, proving
      // the suspended execution remained pinned even though new work is blocked.
      await runPage.getByRole('radio', { name: /TypeScript/, disabled: false }).click();
      await expect(runPage.getByText('Pinned execution completed with version one.')).toBeVisible();
      await expect(runPage.getByPlaceholder('Choose an available run target before sending a message')).toBeDisabled();

      // An explicit selection is the only action that clears the deletion
      // invalidation. The next run then resolves the recreated pointer to v2,
      // which is persisted and executed by the real server path.
      await chooseRecreatedReleaseLabel(runPage);
      await expect(runPage.getByPlaceholder('Enter your message...')).toBeEnabled();
      await runPage.getByPlaceholder('Enter your message...').fill('Start a new release run after reselection.');
      await runPage.getByPlaceholder('Enter your message...').press('Enter');
      await expect(currentRunStatus).toContainText(`${CUSTOM_LABEL} · v2`);
      const secondTypeScriptChoice = runPage.getByRole('radio', { name: /TypeScript/, disabled: false });
      await expect(secondTypeScriptChoice).toBeEnabled({ timeout: 15_000 });
      await secondTypeScriptChoice.click();
      await expect(runPage.getByText('Pinned execution completed with version two.')).toBeVisible();

      const finalLabels = await listLabels(request);
      const persistedLabel: AgentVersionLabel | undefined = finalLabels.labels.find(
        label => label.name === CUSTOM_LABEL,
      );
      expect(persistedLabel?.versionId).toBe(versionTwo.id);

      // Capture only after every interaction so breakpoint-driven panel layout
      // changes cannot alter the acceptance run while the journey is in progress.
      await captureResponsiveArtifacts(runPage, testInfo, 'playground');

      await managementPage.bringToFront();
      const closeToastButtons = managementPage.getByRole('button', { name: 'Close toast' });
      while ((await closeToastButtons.count()) > 0) {
        await closeToastButtons.first().click();
      }
      await captureResponsiveArtifacts(managementPage, testInfo, 'label-manager');
    });
  });
});
