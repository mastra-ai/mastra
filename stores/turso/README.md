# @mastra/turso

A Mastra storage adapter for local [Turso Database](https://github.com/tursodatabase/turso) files.

## Installation

```bash
npm install @mastra/turso
```

## Usage

```typescript
import { TursoStore } from '@mastra/turso';

const storage = new TursoStore({
  id: 'local-storage',
  path: './mastra.db',
});

await storage.init();
```

The adapter supports macOS arm64, Windows x64, and glibc-based Linux on x64 and arm64. Call `getTursoDatabaseSupport()` before construction when an application needs to select a fallback on unsupported systems.

Experimental Turso Database features are disabled by default. Enable them explicitly when required:

```typescript
const storage = new TursoStore({
  id: 'multiprocess-storage',
  path: './mastra.db',
  experimental: ['multiprocess_wal'],
});
```

This package provides Mastra storage domains only. It does not include a vector store.
