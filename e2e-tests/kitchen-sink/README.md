# Kitchen Sink E2E Tests - Easy Guide 🧪

This project tests the entire Mastra workflow from start to finish - from the Studio UI all the way to AI SDK LLM calls. Think of it as a quality check that simulates exactly what a real user experiences.

## What Does This Test?

We're testing the complete user journey by mocking the returned value from what is returned from the `model` key in an agent configuration using [AI SDK testing tools](https://ai-sdk.dev/docs/ai-sdk-core/testing).

---

## Getting Started

Follow these steps in order to set up and run the tests:

### Step 1: Install Dependencies at Root Level

Navigate to the root of the Mastra repository and install all dependencies:

```sh
# From the root of https://github.com/mastra-ai/mastra
pnpm i
```

### Step 2: Build the Entire Project

Build all Mastra packages from the root:

```sh
# From the root of https://github.com/mastra-ai/mastra
pnpm build
```

**Why?** The E2E tests need compiled versions of all Mastra packages to work properly.

### Step 3: Install E2E Test Dependencies

Navigate to the kitchen-sink test directory and install its specific dependencies:

```sh
# From the root of https://github.com/mastra-ai/mastra
cd e2e-tests/kitchen-sink

# Install dependencies (ignore workspace to use local setup)
pnpm i --ignore-workspace
```

### Step 4: Run the Tests

Choose one of these options:

**Option A: Interactive UI Mode (Recommended for development)**

```sh
# If you're not already in the directory
cd e2e-tests/kitchen-sink

# Run tests with UI
pnpm run test:e2e:ui
```

After 1-2 minutes, Playwright's UI will open showing all available test suites in a sidebar on the left. Click any test to run it and see results in real-time.

**Option B: Headless Mode (For CI/terminal)**

```sh
pnpm test:e2e
```

---

## Important Things to Know ⚠️

### Caveat 1: You MUST Rebuild After Changes

Every time you modify any Mastra code, you need to:

1. Rebuild the entire project (step 2): run `pnpm build` from the root directory
2. Restart the `pnpm test:e2e` command

**Why?** The tests use the compiled packages, not your source code directly.

### Caveat 2: Memory-Related Tests Need Fresh Starts

You MUST restart `pnpm run test:e2e:ui` if you want to re-run a test using memory.

**Why?** Memory persists between runs, which can cause incorrect assertions. For example: verifying the thread list main message - if you already ran a test, it will have 2 entries instead of one.

**Note:** We don't have a way to reset memory for now.

---

## Project Structure

Here's what each part of the project does:

- **`./template`**: This is the actual Mastra application we are testing.
  - ⚠️ **Warning:** You will NOT have TypeScript completion here for technical reasons

- **`./setup.ts`**: This is the actual E2E test setup file.

---

## Behind the Scenes: What Happens When Running Tests

Understanding the test workflow helps troubleshoot issues. Here's the complete process:

### The Test Pipeline

1. **Spawn Local NPM Instance**: We spawn a local NPM instance using [Verdaccio](https://verdaccio.org/)
2. **Publish Packages**: We publish all the Mastra packages to that specific Verdaccio instance

3. **Compute Template Version**: We compute a specific version of the `template` in `/tmp/**`. This version will have the `package.json` modified with the versions published to the local NPM instance (should start with `kitchen-sink-e2e-test`)

4. **Run Tests**: We run the E2E tests against that specific application

### Why This Complex Setup?

The reason for having this entire and complex setup is that we are testing as close as what the user is expecting to see as possible - starting from the NPM experience until reaching the LLM response.

By simulating the entire user experience from package installation through AI responses, we catch issues that simpler tests might miss.

---

## Quick Troubleshooting

| Problem                          | Solution                                                    |
| -------------------------------- | ----------------------------------------------------------- |
| Tests fail after code changes    | Rebuild project: `pnpm build` from root, then restart tests |
| Memory-related test failures     | Restart test UI completely                                  |
| TypeScript errors in `template/` | This is expected - no autocomplete in template directory    |
| Tests show unexpected data       | Check if you need to restart for memory reset               |
