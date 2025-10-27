---
title: "Templates "
description: Pre-built project structures that demonstrate common Mastra use cases and patterns
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Templates

Templates are pre-built Mastra projects that demonstrate specific use cases and patterns. Browse available templates in the [templates directory](https://mastra.ai/templates).

## Using Templates

Install a template using the `create-mastra` command:

<Tabs groupId="package-manager">
  <TabItem value="npx" label="npx" default>
    ```bash copy
    npx create-mastra@latest --template template-name
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn dlx create-mastra@latest --template template-name
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm create mastra@latest --template template-name
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```bash copy
    bun create mastra@latest --template template-name
    ```
  </TabItem>
</Tabs>

For example, to create a text-to-SQL application:

```bash copy
npx create-mastra@latest --template text-to-sql
```

## Setting Up a Template

After installation:

1. **Navigate to your project**:

   ```bash copy
   cd your-project-name
   ```

2. **Configure environment variables**:

   ```bash copy
   cp .env.example .env
   ```

   Edit `.env` with your API keys as specified in the template's README.

3. **Start development**:
   ```bash copy
   npm run dev
   ```

:::note

Each template includes a comprehensive README with specific setup instructions and usage examples.

:::

For detailed information on creating templates, see the [Templates Reference](/docs/reference/templates/overview).
