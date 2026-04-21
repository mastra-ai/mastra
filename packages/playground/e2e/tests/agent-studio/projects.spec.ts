import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

const END_USER_PERMISSIONS = [
  'agents:read',
  'agents:execute',
  'stored-agents:read',
  'stored-agents:write',
  'stored:read',
  'stored:write',
  'tools:read',
  'workflows:read',
  'user:write',
];

/**
 * FEATURE: Projects (supervisor-led workspaces)
 * USER STORY: A team member creates a project, invites sub-agents, and sees a
 * chat surface with a shared task pane. Tasks CRUD persists via the server.
 */
test.describe('Agent Studio Projects — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('sidebar exposes a top-level Projects link that routes to the projects list', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/agents');

    const projectsLink = page.locator('nav a[href="/agent-studio/projects"]').first();
    await expect(projectsLink).toBeVisible();

    await projectsLink.click();
    await expect(page).toHaveURL(/\/agent-studio\/projects$/);
  });

  test('creating a project lands on the chat view and the task pane', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/projects/create');

    const projectName = `Launch Plan ${Date.now().toString(36)}`;
    await page.getByTestId('project-name-input').fill(projectName);
    await page.getByTestId('project-description-input').fill('Created by the E2E suite.');
    await page.getByTestId('project-instructions-input').fill('You coordinate the team.');
    await page.getByTestId('project-create-submit').click();

    // Chat URL is /agent-studio/projects/:id/chat — wait for the route to settle.
    await expect(page).toHaveURL(/\/agent-studio\/projects\/[^/]+\/chat/, { timeout: 15000 });

    // The tasks pane is present.
    await expect(page.getByTestId('project-tasks-panel')).toBeVisible();
  });

  test('task CRUD (add → toggle done → delete) persists via the server', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    // Seed a project directly via the API to skip the create form.
    const createResponse = await page.request.post('/api/projects', {
      data: {
        name: 'Tasks CRUD Project',
        instructions: 'Coordinate the team.',
        model: { provider: 'openai', name: 'gpt-4o' },
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const project = (await createResponse.json()) as { id: string };

    await page.goto(`/agent-studio/projects/${project.id}/chat`);
    await expect(page.getByTestId('project-tasks-panel')).toBeVisible();

    // Add a task.
    const taskTitle = `Write spec ${Date.now().toString(36)}`;
    await page.getByTestId('project-task-input').fill(taskTitle);
    await page.getByTestId('project-task-add').click();
    await expect(page.getByText(taskTitle).first()).toBeVisible({ timeout: 10000 });

    // Reload: task persisted server-side.
    await page.reload();
    await expect(page.getByText(taskTitle).first()).toBeVisible({ timeout: 10000 });

    // Read the task id back from the server so we can target its toggle button.
    const getResponse = await page.request.get(`/api/projects/${project.id}`);
    const body = (await getResponse.json()) as { project: { tasks: Array<{ id: string; title: string }> } };
    const task = body.project.tasks.find(t => t.title === taskTitle);
    expect(task).toBeTruthy();

    // Toggle done and then delete.
    await page.getByTestId(`project-task-toggle-${task!.id}`).click();
    await page.getByTestId(`project-task-delete-${task!.id}`).click();
    await expect(page.getByText(taskTitle)).toHaveCount(0, { timeout: 10000 });
  });
});
