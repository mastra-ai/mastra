---
'mastra': minor
'@mastra/deployer': minor
'@mastra/playground-ui': minor
---

Added support for request context presets in Mastra Studio. You can now define a JSON file with named requestContext presets and pass it via the `--request-context-presets` CLI flag to both `mastra dev` and `mastra studio` commands. A dropdown selector appears in the Studio Playground, allowing you to quickly switch between preset configurations.

**Usage:**

```bash
mastra dev --request-context-presets ./presets.json
mastra studio --request-context-presets ./presets.json
```

**Presets file format:**

```json
{
  "development": { "userId": "dev-user", "env": "development" },
  "production": { "userId": "prod-user", "env": "production" }
}
```

When presets are loaded, a dropdown appears above the JSON editor on the Request Context page. Selecting a preset populates the editor, and manually editing the JSON automatically switches back to "Custom".
