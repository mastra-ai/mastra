## 7. Sandbox command registry

`WorkspaceSandbox` gains optional methods for declaring known commands:

```ts
interface WorkspaceSandbox {
  // ...existing fields...
  defineCommand?(name: string, definition?: CommandDefinition): void;
  getCommands?(): Record<string, CommandDefinition>;
}

interface SandboxConfig {
  commandPolicy?: 'open' | 'restricted'; // default 'open'
  commands?: Record<string, CommandDefinition | null>;
}

interface CommandDefinition {
  execute?: (args: string[], options: ExecuteCommandOptions) => Promise<CommandResult>;
  env?: Record<string, string>;
  description?: string;
}
```

Resolution rules:
- Structured form (`execute('gh', ['pr', 'list'])`) consults the registry.
- String form (`execute('gh pr list')`) skips the registry — no parsing.
- Registered `env` overrides caller `env` for the same keys (security boundary).
- `'restricted'` policy: unregistered commands return `{ exitCode: 127 }`.
- `'open'` policy (default): unregistered commands run normally.

---
