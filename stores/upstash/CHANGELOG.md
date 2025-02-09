# @mastra/upstash

## 0.1.0-alpha.4

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94

## 0.1.0-alpha.3

### Patch Changes

- Updated dependencies [5285356]
  - @mastra/core@0.2.0-alpha.93

## 0.1.0-alpha.2

### Minor Changes

- c87eb4e: Combine Upstash packages into `@mastra/upstash`.

  - Move and combine packages to `stores/upstash`
  - Reorganize source files into `src/vector` and `src/store`
  - Add deprecation notices to old packages
  - Update documentation and examples
  - No breaking changes in functionality

## 0.1.0-alpha.1

### Major Changes

- Combined @mastra/vector-upstash and @mastra/store-upstash into a single package
- Moved source code into src/vector and src/storage directories
- Updated package exports to include both vector and storage functionality
- Updated documentation to reflect combined package structure
- Added proper test skipping for vector tests when credentials are not available

### Migration Guide

If you were previously using either @mastra/vector-upstash or @mastra/store-upstash, you'll need to:

1. Update your package.json to use @mastra/upstash instead
2. Update your imports:
   - Change `import { UpstashVector } from '@mastra/vector-upstash'` to `import { UpstashVector } from '@mastra/upstash'`
   - Change `import { UpstashStore } from '@mastra/store-upstash'` to `import { UpstashStore } from '@mastra/upstash'`
