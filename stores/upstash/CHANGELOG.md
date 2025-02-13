# @mastra/upstash

## 0.1.0-alpha.15

### Patch Changes

- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105

## 0.1.0-alpha.14

### Patch Changes

- b97ca96: Tracing into default storage
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104

## 0.1.0-alpha.13

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103

## 0.1.0-alpha.12

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102

## 0.1.0-alpha.11

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101

## 0.1.0-alpha.10

### Patch Changes

- Updated dependencies [9d1796d]
  - @mastra/core@0.2.0-alpha.100

## 0.1.0-alpha.9

### Patch Changes

- Updated dependencies [7d83b92]
  - @mastra/core@0.2.0-alpha.99

## 0.1.0-alpha.8

### Patch Changes

- 70dabd9: Fix broken publish
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98

## 0.1.0-alpha.7

### Patch Changes

- 07c069d: Update build script
- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
  - @mastra/core@0.2.0-alpha.97

## 0.1.0-alpha.6

### Patch Changes

- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96

## 0.1.0-alpha.5

### Patch Changes

- Updated dependencies [9fb59d6]
  - @mastra/core@0.2.0-alpha.95

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
