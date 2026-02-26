# Contributing to Mastra

Welcome to Mastra! We welcome contributions of any size and skill level. Thanks for taking the time to contribute!

> [!Tip]
>
> **For new contributors:** Take a look at [https://github.com/firstcontributions/first-contributions](https://github.com/firstcontributions/first-contributions) for helpful information on contributing to open source projects.

## Contributor guidelines

Please read the guidance below about what to do if you:

- [Found a bug](#did-you-find-a-bug)
- [Fixed a bug](#did-you-write-a-patch-that-fixes-a-bug)
- [Want to add a new feature or change an existing one](#do-you-intend-to-add-a-new-feature-or-change-an-existing-one)
- [Want to improve documentation](#want-to-improve-documentation)

Read the [Development Guide](./DEVELOPMENT.md) for information on setting up a development environment.

### Did you find a bug?

- Ensure that the bug was not already reported by searching in the [GitHub issues](https://github.com/mastra-ai/mastra/issues)
- If you're unable to find an open issue addressing the problem, [open a new bug report](https://github.com/mastra-ai/mastra/issues/new?template=bug_report.yml) providing a [minimal reproduction](#minimal-reproduction) of the issue.

Be sure to include a title and clear description, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Did you write a patch that fixes a bug?

- Open a new GitHub pull request with the patch
- Ensure the PR description clearly describes the problem and solution. Include the relevant issue number if applicable

### Do you intend to add a new feature or change an existing one?

- Open a [feature request](https://github.com/mastra-ai/mastra/issues/new?template=feature_request.yml) and wait for feedback from the Mastra maintainers
- Assuming you get positive feedback, raise a pull request against your fork/branch to track the development of the feature and discuss the implementation.

### Want to improve documentation?

Read the [documentation contribution guidelines](./docs/CONTRIBUTING.md) for more details.

## Minimal reproduction

A minimal reproduction is a simplified Mastra project that demonstrates a bug with the least amount of code necessary. This helps isolate the issue and makes it easier for maintainers to verify and fix the problem. A minimal reproduction also proves that the bug is not caused by other parts of your codebase or environment. Lastly, creating a minimal reproduction often helps you identify the root cause of the issue yourself.

### 1. Start with a fresh project

Create a new Mastra project:

```bash
npx create-mastra@latest bug-reproduction
cd bug-reproduction
```

Alternatively, you can start from one of the examples in the `/examples` directory that's closest to your use case, then strip it down to the minimum.

### 2. Add only what's needed to demonstrate the bug

**Do add:**

- The specific Mastra packages related to the issue (e.g., `@mastra/core`, `@mastra/rag`, `@mastra/pg`)
- Minimal configuration to reproduce the bug
- Only the code that triggers the error

**Don't add:**

- Your entire production codebase
- Multiple unrelated features
- Custom UI components or styling
- Business logic unrelated to the bug
- Environment-specific configurations

**For specific issues:**

- **Agents**: Include only the minimal agent configuration and tools needed
- **Integrations**: Add only the specific integration that's problematic
- **Storage/Memory**: Include only the relevant store adapter
- **Workflows**: Include only the minimal workflow steps that reproduce the issue
- **Tools**: Add only the tool causing the problem

### 3. Verify the reproduction

Test that your minimal reproduction actually demonstrates the problem:

- Run the reproduction in a clean environment
- Confirm you see the expected error or unexpected behavior
- Try removing code to see if you can make it even more minimal
- If you fixed the issue while creating the reproduction, document what you changed

### 4. Publish and share

Create a public GitHub repository with your reproduction:

1. Push your code to GitHub
2. Add a clear README.md that includes:
   - Description of the expected vs actual behavior
   - Exact steps to reproduce (install, build, run commands)
   - Which command or action triggers the error
   - Your environment (Node version, package manager, OS)
3. Link to the repository in your GitHub issue

### Troubleshooting common scenarios

**LLM/API keys**:

- Use mock responses when possible to avoid requiring real API keys
- If real keys are needed, clearly document which services require authentication
- If possible, use OpenAI as it is widely accessible
- Consider using environment variable examples: `OPENAI_API_KEY=your-key-here`

**Docker services**:

- Note if the reproduction requires `pnpm dev:services:up` for PostgreSQL, Redis, etc.
- Specify which services are needed

**Build vs runtime issues**:

- Clarify if the bug occurs during `mastra build`, `mastra dev`, or at runtime
- Include build output if it's a build-time error

**Monorepo context**:

- If the issue is in a specific package, mention which one
- Note if the issue only occurs when built from the monorepo root

### Optional steps

For complex reproductions, you may also need to:

- **Observability**: Include logs from observability providers if relevant to the issue
- **Production-only bugs**: If the issue only occurs in deployed environments, provide details about your deployment platform (Vercel, Netlify, Cloudflare, etc.)
- **Specific LLM models**: Document if the bug only occurs with certain models or providers
- **Screenshots/videos**: For UI-related issues, include visual documentation of the problem
- **Network traces**: For integration issues, include relevant network request/response data

A well-crafted minimal reproduction is the best way to get your issue resolved quickly.
