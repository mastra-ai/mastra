# Mastra Agent Examples

This directory contains example agents demonstrating various Mastra features.

## Getting Started

1. Install dependencies (from the repository root):

   ```bash
   pnpm install
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. Run the example:
   ```bash
   pnpm start
   ```

## Available Scripts

- `pnpm start` - Run the agent examples
- `pnpm mastra:dev` - Start Mastra development server
- `pnpm mastra:studio` - Open Mastra Studio UI
- `pnpm mastra:build` - Build for production
- `pnpm mastra:start` - Start production server

## Request Context Presets

This example includes a demonstration of Mastra's **Request Context Presets** feature, which allows you to define named configurations that can be easily switched between in the Studio UI.

### What are Request Context Presets?

Request context presets are predefined JSON configurations that can be selected from a dropdown in the Mastra Studio Playground. This feature enables you to quickly switch between different environments, user roles, or scenarios without manually editing JSON each time.

### Using Request Context Presets

#### 1. Running with Presets in Dev Mode

```bash
mastra dev --request-context-presets ./request-context-presets.json
```

#### 2. Running with Presets in Studio Mode

```bash
mastra studio --request-context-presets ./request-context-presets.json
```

#### 3. Using the Presets Dropdown

Once you start Mastra with the `--request-context-presets` flag:

1. Open the Mastra Studio in your browser
2. Navigate to an agent's page
3. Look for the **Request Context** section
4. You'll see a dropdown with available presets
5. Select a preset to automatically populate the JSON editor with that configuration
6. Click "Save" to apply the context to your agent interactions

The dropdown includes a "Custom" option that is automatically selected when you manually edit the JSON.

### Available Presets in This Example

This example includes the following presets in `request-context-presets.json`:

#### Environment Presets

- **development**: Development environment with debug logging
  - API endpoint: `https://dev-api.example.com`
  - Debug mode: enabled
  - Log level: debug

- **production**: Production environment with minimal logging
  - API endpoint: `https://api.example.com`
  - Debug mode: disabled
  - Log level: error

- **staging**: Staging environment for testing
  - API endpoint: `https://staging-api.example.com`
  - Debug mode: enabled
  - Log level: info

#### Role-Based Presets

- **admin-user**: Full administrative access
  - Permissions: read, write, delete, manage
  - Advanced tools: enabled
  - Analytics: enabled

- **guest-user**: Limited read-only access
  - Permissions: read only
  - Advanced tools: disabled
  - Analytics: disabled

### Request Context Demo Agent

The `requestContextDemoAgent` demonstrates how agents can dynamically adapt their behavior based on the request context:

#### Dynamic Agent Behavior

- **Instructions**: Vary by environment and role
  - Development mode includes verbose debugging instructions
  - Production mode provides optimized, concise guidance
  - Log level affects response detail

- **Model Selection**: Automatically chooses appropriate model
  - Production: `gpt-4o` (higher quality)
  - Development/Staging: `gpt-4o-mini` (faster iteration)

- **Tool Availability**: Conditionally provides tools based on permissions
  - `apiRequestTool`: Available to all users, uses environment-specific endpoints
  - `adminActionTool`: Only available with "manage" permission
  - `analyticsTool`: Only available when `features.analytics` is enabled

#### Testing Different Presets

Try switching between presets to see how the agent behaves differently:

1. Select the **development** preset and ask: "Make an API request to fetch user data"
   - Agent will use the dev API endpoint with debug logging

2. Select the **admin-user** preset and ask: "Show me analytics for the platform"
   - Agent will have access to analytics tools

3. Select the **guest-user** preset and ask the same question
   - Agent will explain it doesn't have permission for analytics

### Creating Your Own Presets File

You can create custom presets for your own use cases:

```json
{
  "preset-name": {
    "customField": "value",
    "nested": {
      "data": "example"
    }
  },
  "another-preset": {
    "userId": "user-123",
    "tenant": "acme-corp"
  }
}
```

Requirements:

- The file must contain a valid JSON object
- Each preset must be an object (not a string, number, or array)
- Preset values can contain any valid JSON structure

### Benefits

- **Faster Testing**: Switch between configurations instantly
- **Consistency**: Ensure the same configuration is used across team members
- **Documentation**: Preset names serve as documentation of supported scenarios
- **No Manual Editing**: Reduce errors from typing JSON manually
- **Environment Parity**: Test production configurations in development

## Learn More

- [Mastra Documentation](https://mastra.ai/docs)
- [Request Context Guide](https://mastra.ai/docs/core-concepts/request-context)
