---
'@mastra/playground-ui': minor
---

Added a reusable environment variables editor with .env upload and bulk paste support.

```tsx
import {
  EnvironmentVariablesEditor,
  useEnvironmentVariablesEditor,
} from '@mastra/playground-ui';

function SettingsEnvVars() {
  const editor = useEnvironmentVariablesEditor({
    initialRows: [{ key: 'PUBLIC_BASE_URL', value: 'https://example.com' }],
  });

  return (
    <EnvironmentVariablesEditor
      editor={editor}
      actions={
        <button type="button" onClick={() => editor.getEnvironmentVariablesForSubmit()}>
          Save
        </button>
      }
    />
  );
}
```
