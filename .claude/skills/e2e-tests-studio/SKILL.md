---
name: e2e-tests-studio
description: >
  REQUIRED when modifying any file in packages/playground-ui or packages/playground.
  Triggers on: React component creation/modification/refactoring, UI changes,
  new playground features, bug fixes affecting studio UI. Generates Playwright E2E tests
  that validate PRODUCT BEHAVIOR, not just UI states.
model: claude-opus-4-5
---

# E2E Behavior Validation for Frontend Modifications

## Core Principle: Test Product Behavior, Not UI States

**CRITICAL**: Tests must verify that product features WORK correctly, not just that UI elements render.

### What NOT to test (UI States):

- ❌ "Dropdown opens when clicked"
- ❌ "Modal appears after button click"
- ❌ "Loading spinner shows during request"
- ❌ "Form fields are visible"
- ❌ "Sidebar collapses"

### What TO test (Product Behavior):

- ✅ "Selecting an LLM provider configures the agent to use that provider"
- ✅ "Creating a new agent persists it and shows in the agents list"
- ✅ "Running a tool with parameters returns the expected output"
- ✅ "Chat messages stream correctly and maintain conversation context"
- ✅ "Workflow execution triggers tools in the correct order"

## Prerequisites

Requires Playwright MCP server. If the `browser_navigate` tool is unavailable, instruct the user to add it:

```sh
claude mcp add playwright -- npx @playwright/mcp@latest
```

## Step 1: Understand the Feature Intent

Before writing ANY test, answer these questions:

1. **What user problem does this feature solve?**
2. **What is the expected outcome when the feature works correctly?**
3. **What data flows through the system?** (user input → API → state → UI)
4. **What should persist after page reload?**
5. **What downstream effects should this action have?**

Document these answers as comments in your test file.

## Step 2: Build and Start

```sh
pnpm build:cli
cd packages/playground/e2e/kitchen-sink && pnpm dev
```

Verify server at http://localhost:4111

## Step 3: Map Feature to Behavior Tests

### Feature-to-Test Mapping Guide

| Feature Category           | What to Test                                      | Example Assertion                                            |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| **Agent Configuration**    | Config changes affect agent behavior              | Send message → verify response uses selected model           |
| **LLM Provider Selection** | Selected provider is used in requests             | Intercept API call → verify provider in request payload      |
| **Tool Execution**         | Tool runs with correct params & returns result    | Execute tool → verify output matches expected transformation |
| **Workflow Execution**     | Steps execute in order, data flows between steps  | Run workflow → verify each step's output feeds next step     |
| **Chat/Streaming**         | Messages persist, context maintained across turns | Multi-turn conversation → verify context awareness           |
| **MCP Server Tools**       | Server tools are callable and return data         | Call MCP tool → verify response structure and content        |
| **Memory/Persistence**     | Data survives page reload                         | Create item → reload → verify item exists                    |
| **Error Handling**         | Errors surface correctly to user                  | Trigger error condition → verify error message + recovery    |

## Step 4: Write Behavior-Focused Tests

### Test Structure Template

```ts
import { test, expect, Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { selectFixture } from '../__utils__/select-fixture';
import { nanoid } from 'nanoid';

/**
 * FEATURE: [Name of feature]
 * USER STORY: As a user, I want to [action] so that [outcome]
 * BEHAVIOR UNDER TEST: [Specific behavior being validated]
 */

test.describe('[Feature Name] - Behavior Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await resetStorage(page);
  });

  test('should [verb describing behavior] when [trigger condition]', async () => {
    // ARRANGE: Set up preconditions
    // - Navigate to the feature
    // - Configure any required state
    // ACT: Perform the user action that triggers the behavior
    // ASSERT: Verify the OUTCOME, not the UI state
    // - Check data persistence
    // - Verify downstream effects
    // - Confirm API calls made correctly
  });
});
```

### Behavior Test Patterns

#### Pattern 1: Configuration Affects Behavior

```ts
test('selecting LLM provider should use that provider for agent responses', async () => {
  // ARRANGE
  await page.goto('/agents/my-agent/chat');

  // Intercept API to verify provider
  let capturedProvider: string | null = null;
  await page.route('**/api/chat', route => {
    const body = JSON.parse(route.request().postData() || '{}');
    capturedProvider = body.provider;
    route.continue();
  });

  // ACT: Select a different provider
  await page.getByTestId('provider-selector').click();
  await page.getByRole('option', { name: 'OpenAI' }).click();

  // Send a message to trigger the agent
  await page.getByTestId('chat-input').fill('Hello');
  await page.getByTestId('send-button').click();

  // ASSERT: Verify the selected provider was used
  await expect.poll(() => capturedProvider).toBe('openai');
});
```

#### Pattern 2: Data Persistence

```ts
test('created agent should persist after page reload', async () => {
  // ARRANGE
  await page.goto('/agents');
  const agentName = `Test Agent ${nanoid()}`;

  // ACT: Create new agent
  await page.getByTestId('create-agent-button').click();
  await page.getByTestId('agent-name-input').fill(agentName);
  await page.getByTestId('save-agent-button').click();

  // Wait for creation to complete
  await expect(page.getByText(agentName)).toBeVisible();

  // ASSERT: Verify persistence
  await page.reload();
  await expect(page.getByText(agentName)).toBeVisible({ timeout: 10000 });
});
```

#### Pattern 3: Tool Execution Produces Correct Output

```ts
test('weather tool should return formatted weather data', async () => {
  // ARRANGE
  await selectFixture(page, 'weather-success');
  await page.goto('/tools/weather-tool');

  // ACT: Execute tool with parameters
  await page.getByTestId('param-city').fill('San Francisco');
  await page.getByTestId('execute-tool-button').click();

  // ASSERT: Verify OUTPUT content, not just that output appears
  const output = page.getByTestId('tool-output');
  await expect(output).toContainText('temperature');
  await expect(output).toContainText('San Francisco');

  // Verify structured data if applicable
  const outputText = await output.textContent();
  const outputData = JSON.parse(outputText || '{}');
  expect(outputData).toHaveProperty('temperature');
  expect(outputData).toHaveProperty('conditions');
});
```

#### Pattern 4: Workflow Step Chaining

```ts
test('workflow should pass data between steps correctly', async () => {
  // ARRANGE
  await selectFixture(page, 'workflow-multi-step');
  const sessionId = nanoid();
  await page.goto(`/workflows/data-pipeline?session=${sessionId}`);

  // ACT: Trigger workflow execution
  await page.getByTestId('workflow-input').fill('test input data');
  await page.getByTestId('run-workflow-button').click();

  // ASSERT: Verify each step received correct input from previous step
  // Wait for completion
  await expect(page.getByTestId('workflow-status')).toHaveText('completed', { timeout: 30000 });

  // Check step outputs show data transformation chain
  const step1Output = await page.getByTestId('step-1-output').textContent();
  const step2Output = await page.getByTestId('step-2-output').textContent();

  // Verify step 2 received step 1's output as input
  expect(step2Output).toContain(step1Output);
});
```

#### Pattern 5: Streaming Chat with Context

```ts
test('chat should maintain conversation context across messages', async () => {
  // ARRANGE
  await selectFixture(page, 'contextual-chat');
  const chatId = nanoid();
  await page.goto(`/agents/assistant/chat/${chatId}`);

  // ACT: Multi-turn conversation
  await page.getByTestId('chat-input').fill('My name is Alice');
  await page.getByTestId('send-button').click();
  await expect(page.getByTestId('assistant-message').last()).toBeVisible({ timeout: 20000 });

  await page.getByTestId('chat-input').fill('What is my name?');
  await page.getByTestId('send-button').click();

  // ASSERT: Verify context was maintained
  const response = page.getByTestId('assistant-message').last();
  await expect(response).toContainText('Alice', { timeout: 20000 });
});
```

#### Pattern 6: Error Recovery

```ts
test('should show actionable error and allow retry when API fails', async () => {
  // ARRANGE: Set up failure fixture
  await selectFixture(page, 'api-failure');
  await page.goto('/tools/flaky-tool');

  // ACT: Trigger the error
  await page.getByTestId('execute-tool-button').click();

  // ASSERT: Error is shown with recovery option
  await expect(page.getByTestId('error-message')).toContainText('failed');
  await expect(page.getByTestId('retry-button')).toBeVisible();

  // Switch to success fixture and retry
  await selectFixture(page, 'api-success');
  await page.getByTestId('retry-button').click();

  // Verify recovery worked
  await expect(page.getByTestId('tool-output')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('error-message')).not.toBeVisible();
});
```

## Step 5: Update Existing Tests

When a test file already exists:

1. **Read the existing tests** to understand current coverage
2. **Identify if tests are UI-focused or behavior-focused**
3. **Refactor UI-focused tests** to verify behavior instead:

### Refactoring Example

**BEFORE (UI-focused):**

```ts
test('dropdown opens when clicked', async () => {
  await page.getByTestId('model-dropdown').click();
  await expect(page.getByRole('listbox')).toBeVisible();
});
```

**AFTER (Behavior-focused):**

```ts
test('selecting model from dropdown updates agent configuration', async () => {
  // Open dropdown and select model
  await page.getByTestId('model-dropdown').click();
  await page.getByRole('option', { name: 'GPT-4' }).click();

  // Verify the selection persists and affects behavior
  await page.reload();
  await expect(page.getByTestId('model-dropdown')).toHaveText('GPT-4');

  // Optionally: verify the model is used in actual requests
  // (via request interception or checking response metadata)
});
```

## Step 6: Kitchen-Sink Fixtures for Behavior Testing

Fixtures should represent **realistic scenarios**, not just mock data:

### Fixture Naming Convention

```
<feature>-<scenario>.fixture.ts

Examples:
- agent-with-tools.fixture.ts
- chat-multi-turn-context.fixture.ts
- workflow-parallel-execution.fixture.ts
- tool-validation-error.fixture.ts
- mcp-server-timeout.fixture.ts
```

### Fixture Content Requirements

Each fixture must define:

1. **Scenario description** (what behavior it enables testing)
2. **Expected outcomes** (what assertions should pass)
3. **Edge cases covered** (error states, empty states, etc.)

```ts
// fixtures/agent-provider-switch.fixture.ts
export const agentProviderSwitch = {
  name: 'agent-provider-switch',
  description: 'Tests that switching LLM providers changes agent behavior',

  // Mock responses for different providers
  responses: {
    openai: { content: 'Response from OpenAI', model: 'gpt-4' },
    anthropic: { content: 'Response from Anthropic', model: 'claude-3' },
  },

  expectedBehavior: {
    // When provider is switched, subsequent messages use new provider
    providerSwitchAffectsNextMessage: true,
    // Provider selection persists across page reload
    providerPersistsOnReload: true,
  },
};
```

## Step 7: Run and Validate

```sh
cd packages/playground && pnpm test:e2e
```

### Test Quality Checklist

Before considering tests complete, verify:

- [ ] Each test has a clear user story comment
- [ ] Tests verify OUTCOMES, not intermediate UI states
- [ ] Tests would FAIL if the feature broke (not just if UI changed)
- [ ] Persistence is verified via `page.reload()` where applicable
- [ ] Error scenarios are covered
- [ ] Tests use appropriate timeouts for async operations
- [ ] Fixtures represent realistic usage scenarios

## Quick Reference

| Step      | Command/Action                                        |
| --------- | ----------------------------------------------------- |
| Build     | `pnpm build:cli`                                      |
| Start     | `cd packages/playground/e2e/kitchen-sink && pnpm dev` |
| App URL   | http://localhost:4111                                 |
| Routes    | `@packages/playground/src/App.tsx`                    |
| Run tests | `cd packages/playground && pnpm test:e2e`             |
| Test dir  | `packages/playground/e2e/tests/`                      |
| Fixtures  | `packages/playground/e2e/kitchen-sink/fixtures/`      |

## Anti-Patterns to Avoid

| ❌ Don't                           | ✅ Do Instead                                                |
| ---------------------------------- | ------------------------------------------------------------ |
| Test that modal opens              | Test that modal action completes and persists                |
| Test that button is clickable      | Test that clicking button produces expected result           |
| Test loading spinner appears       | Test that loaded data is correct                             |
| Test form validation message shows | Test that invalid form cannot submit AND valid form succeeds |
| Test dropdown has options          | Test that selecting option changes system behavior           |
| Test sidebar navigation works      | Test that navigated page has correct data/functionality      |
| Assert element is visible          | Assert element contains expected data/state                  |
