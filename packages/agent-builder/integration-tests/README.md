# Agent Builder Integration Tests

This directory contains comprehensive integration tests for the Mastra Agent Builder, specifically testing the template merging workflow functionality.

## Test Files

### 1. `merge-template.test.ts`

Tests the AgentBuilder with natural language prompts to merge templates using the `mergeTemplate` tool.

### 2. `template-workflow.test.ts` (Comprehensive Integration Test)

Full end-to-end test that:

- Sets up a real Mastra project from the minimal fixture
- Runs the complete template merge workflow
- Installs dependencies
- Starts a Mastra server
- Validates that both original and new agents/workflows function correctly
- Tests git history and branch management

### 3. `template-workflow-mock.test.ts` (Unit Tests)

Lightweight tests with mocked dependencies that validate:

- Template API fetching
- Workflow configuration
- Input validation
- Project structure validation

## Running Tests

### Prerequisites

- Node.js and pnpm installed
- For integration tests: `OPENAI_API_KEY` environment variable set
- Git configured with user.name and user.email

### Commands

```bash
# Run all tests
pnpm test

# Run only the mocked unit tests (no API key required)
pnpm test:mock

# Run the full integration template test (requires OPENAI_API_KEY)
pnpm test:template

# Run the agent builder prompt tests
pnpm test:agent

# Run a specific test file
pnpm vitest run ./src/template-workflow.test.ts
```

### Environment Variables

```bash
# Required for integration tests
export OPENAI_API_KEY="your-openai-api-key"

# Optional: Use a different OpenAI model
export OPENAI_MODEL="gpt-4o-mini"
```

## Test Scenarios

### Template Workflow Integration Test

This comprehensive test validates the complete template integration process:

1. **Setup Phase**:
   - Creates a temporary directory
   - Copies the minimal Mastra project fixture
   - Initializes git repository
   - Installs dependencies with pnpm

2. **Template Merge Phase**:
   - Fetches template metadata from Mastra API
   - Runs the merge workflow to integrate `csv-to-questions` template
   - Validates file creation and git history

3. **Server Validation Phase**:
   - Starts a Mastra development server
   - Tests original agents (weather) still work
   - Tests new agents (csvQuestionAgent) are functional
   - Validates workflow registration

4. **Conflict Handling**:
   - Tests duplicate template merging
   - Validates graceful conflict resolution

### Expected Template Files

After merging the `csv-to-questions` template, these files should be created:

- `src/mastra/agents/csvQuestionAgent.ts`
- `src/mastra/tools/csvTool.ts`
- `src/mastra/workflows/csvToQuestionsWorkflow.ts`

### Git History Validation

The test validates that proper git commits are created:

- `feat(template): add agent csvQuestionAgent (csv-to-questions@<sha>)`
- `feat(template): add tool csvTool (csv-to-questions@<sha>)`
- `feat(template): add workflow csvToQuestionsWorkflow (csv-to-questions@<sha>)`
- `feat(template): update package.json for csv-to-questions`

## Debugging

### Common Issues

1. **OpenAI API Key**: Ensure `OPENAI_API_KEY` is set for integration tests
2. **Port Conflicts**: Tests use dynamic port allocation to avoid conflicts
3. **Git Configuration**: Ensure git user.name and user.email are configured
4. **Dependencies**: Run `pnpm install` in the test project before running tests

### Verbose Output

```bash
# Run with verbose output for debugging
pnpm vitest run ./src/template-workflow.test.ts --reporter=verbose

# Run a single test case
pnpm vitest run ./src/template-workflow.test.ts -t "should merge csv-to-questions template"
```

### Test Timeouts

- Mock tests: 5 seconds (default)
- Integration tests: 3 minutes for workflow, 2 minutes for server tests
- Server startup timeout: 30 seconds

## CI/CD Considerations

For CI/CD environments:

1. Use `test:mock` for fast unit tests without external dependencies
2. Use `test:integration` only when OpenAI API key is available
3. Consider using test containers for isolated environments
4. Mock external API calls for reliable CI execution

## Contributing

When adding new tests:

1. Follow the existing pattern of setup/teardown
2. Use descriptive test names
3. Include proper cleanup in `afterAll` hooks
4. Add appropriate timeouts for long-running operations
5. Validate both success and error scenarios
