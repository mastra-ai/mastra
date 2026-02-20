import { test, expect } from '@playwright/test'

test.describe('Learn section', () => {
  test('landing page renders with course title and all 18 lessons', async ({ page }) => {
    await page.goto('/learn')
    await expect(page.locator('h1')).toContainText('Build Your First AI Agent')
    // Published lessons are links, coming soon are plain elements — count all lesson items
    const lessonItems = page.locator('main').locator('[class*="learn-link"], [href="#learn-signup-cta"]')
    await expect(lessonItems.first()).toBeVisible()
    const count = await lessonItems.count()
    expect(count).toBeGreaterThanOrEqual(18)
  })

  test('progress bar starts at zero', async ({ page }) => {
    await page.goto('/learn')
    await expect(page.locator('aside').getByText(/0 of \d+ completed/)).toBeVisible()
  })

  test('published lesson navigation works', async ({ page }) => {
    await page.goto('/learn')
    await page.locator('main a[href="/learn/01-build-ai-agents-with-mastra"]').first().click()
    await expect(page).toHaveURL(/\/learn\/01-build-ai-agents-with-mastra/)
  })

  test('published lesson page has expected structure', async ({ page }) => {
    await page.goto('/learn/01-build-ai-agents-with-mastra')
    // Header
    await expect(page.getByText('Lesson 1 of 18')).toBeVisible()
    await expect(page.locator('h1')).toContainText('Build AI Agents with Mastra')
    // Complete checkbox
    await expect(page.getByText('Mark as complete')).toBeVisible()
    // Prev/Next nav
    await expect(page.locator('main nav a').filter({ hasText: 'Mastra Setup and First Run' })).toBeVisible()
  })

  test('coming soon lessons do not have routes', async ({ page }) => {
    // Coming soon lessons should not have their own page
    await page.goto('/learn/09-build-a-workflow')
    await expect(page.getByText('Page Not Found')).toBeVisible()
  })

  test('coming soon cards on landing page scroll to CTA', async ({ page }) => {
    await page.goto('/learn')
    // Coming soon items should have the signup CTA link
    const comingSoonItem = page.locator('a[href="#learn-signup-cta"]').first()
    await expect(comingSoonItem).toBeVisible()
    // Should show "Coming Early March 2026" text
    await expect(comingSoonItem.getByText('Coming Early March 2026')).toBeVisible()
  })

  test('sidebar shows all lessons grouped by module', async ({ page }) => {
    await page.goto('/learn')
    const sidebar = page.locator('aside')
    await expect(sidebar.getByRole('heading', { name: 'Getting Started' })).toBeVisible()
    await expect(sidebar.getByRole('heading', { name: 'Tools' })).toBeVisible()
    await expect(sidebar.getByRole('heading', { name: 'Workflows' })).toBeVisible()
    await expect(sidebar.getByRole('heading', { name: 'Memory' })).toBeVisible()
    await expect(sidebar.getByRole('heading', { name: 'Production' })).toBeVisible()
  })

  test('sidebar navigation works between published lessons', async ({ page }) => {
    await page.goto('/learn/01-build-ai-agents-with-mastra')
    // Click next lesson in sidebar
    await page.locator('aside a[href="/learn/02-setup-and-first-run"]').click()
    await expect(page).toHaveURL(/\/learn\/02-setup-and-first-run/)
    await expect(page.locator('h1')).toContainText('Mastra Setup and First Run')
  })

  test('sidebar coming soon lessons are not links', async ({ page }) => {
    await page.goto('/learn')
    const sidebar = page.locator('aside')
    // Coming soon lessons should be spans, not links
    const comingSoonItem = sidebar.locator('span').filter({ hasText: 'Build a Workflow' })
    await expect(comingSoonItem).toBeVisible()
    // Should NOT be a link
    expect(await sidebar.locator('a[href="/learn/09-build-a-workflow"]').count()).toBe(0)
  })

  test('complete checkbox persists via localStorage', async ({ page }) => {
    await page.goto('/learn/01-build-ai-agents-with-mastra')
    // Click the label text to toggle complete state (checkbox is sr-only)
    await page.getByText('Mark as complete').click()
    await expect(page.getByText('Complete', { exact: true })).toBeVisible()

    // Navigate away and back to verify localStorage persistence
    await page.goto('/learn')
    await page.goto('/learn/01-build-ai-agents-with-mastra')
    await expect(page.getByText('Complete', { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('progress updates after marking lesson complete', async ({ page }) => {
    await page.goto('/learn/01-build-ai-agents-with-mastra')
    // Click the label text to toggle complete state (checkbox is sr-only)
    await page.getByText('Mark as complete').click()
    await page.goto('/learn')
    await expect(page.locator('aside').getByText(/1 of \d+ completed/)).toBeVisible()
  })

  test('prev/next navigation works', async ({ page }) => {
    await page.goto('/learn/02-setup-and-first-run')
    // Click next in the main content nav (not sidebar)
    const nextLink = page.locator('main nav a[href="/learn/03-mastra-project-structure"]')
    await nextLink.click()
    await expect(page).toHaveURL(/\/learn\/03-mastra-project-structure/)
    // Click prev
    const prevLink = page.locator('main nav a[href="/learn/02-setup-and-first-run"]')
    await prevLink.click()
    await expect(page).toHaveURL(/\/learn\/02-setup-and-first-run/)
  })

  test('nonexistent lesson shows not found', async ({ page }) => {
    await page.goto('/learn/nonexistent-lesson')
    await expect(page.getByText('Page Not Found')).toBeVisible()
  })

  test('Learn tab visible in navbar with new badge', async ({ page }) => {
    await page.goto('/learn')
    const learnTab = page.locator('.tab a').filter({ hasText: 'Learn' })
    await expect(learnTab).toBeVisible()
    // Should have a "new" badge
    await expect(page.locator('.learn-tab-badge')).toBeVisible()
  })

  test('email CTA form is visible on landing page', async ({ page }) => {
    await page.goto('/learn')
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByText('Get notified')).toBeVisible()
  })

  test('mark as complete button at bottom of lesson', async ({ page }) => {
    await page.goto('/learn/01-build-ai-agents-with-mastra')
    // Should have a mark as complete button at the bottom of the content
    const buttons = page.locator('main button').filter({ hasText: 'Mark as complete' })
    await expect(buttons.last()).toBeVisible()
  })

  test('mobile hamburger opens sidebar with learn lessons', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/learn')
    const toggle = page.getByRole('button', { name: 'Toggle navigation bar' })
    await expect(toggle).toBeVisible()
    await toggle.click()
    const mobileSidebar = page.locator('.navbar-sidebar')
    await expect(mobileSidebar).toBeVisible()
    const lessonLink = mobileSidebar.locator('a[href="/learn/01-build-ai-agents-with-mastra"]')
    await expect(lessonLink).toBeVisible({ timeout: 5000 })
    await lessonLink.click()
    await expect(page).toHaveURL(/\/learn\/01-build-ai-agents-with-mastra/)
  })
})
