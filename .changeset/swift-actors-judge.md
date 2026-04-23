---
'@mastra/core': minor
---

Added support for custom language server registration with the `servers` field in `LSPConfig`. Previously, LSP inspection only worked with built-in server definitions for TypeScript, JavaScript, Python, Go, and Rust. You can now register additional language servers, such as PHP, Ruby, Java, Kotlin, Swift, or Elixir, by providing a `CustomLSPServer` definition.

**Example:**

```typescript
const workspace = new Workspace({
  lsp: {
    servers: {
      phpactor: {
        id: 'phpactor',
        name: 'Phpactor Language Server',
        languageIds: ['php'],
        extensions: ['.php'],
        markers: ['composer.json'],
        command: 'phpactor language-server',
      },
    },
  },
});
```

Custom servers are merged with built-in servers and can also override them by using the same ID. Closes #14828.
