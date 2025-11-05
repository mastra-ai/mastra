# Mastra Codemods

Mastra provides automated code transformations (codemods) to help upgrade your codebase when features are deprecated, removed, or changed between versions.

Codemods are transformations that run on your codebase programmatically, allowing you to apply many changes without manually editing every file.

## Quick Start

### Run Individual Codemods

To run a specific codemod:

```sh
npx @mastra/codemod <codemod-name> <path>
```

Examples:

```sh
# Transform a specific file
npx @mastra/codemod v1/mastra-core-imports src/mastra.ts

# Transform a directory
npx @mastra/codemod v1/mastra-core-imports src/lib/

# Transform entire project
npx @mastra/codemod v1/mastra-core-imports .
```

## Available Codemods

### v1 Codemods (v0 → v1 Migration)

| Codemod                  | Description                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `v1/mastra-core-imports` | Updates all imports from `@mastra/core` to use the new subpath imports. For v1, all exports except `Mastra` and `Config` have moved to subpaths. |
| `v1/runtime-context`     | Update `RuntimeContext` to `RequestContext` and rename all instances of parameter names.                                                         |

## CLI Options

### Commands

```sh
npx @mastra/codemod <command> [options]
```

**Available Commands:**

- `<codemod-name> <path>` - Apply specific codemod

### Global Options

- `--dry` - Preview changes without applying them
- `--print` - Print transformed code to stdout
- `--verbose` - Show detailed transformation logs

### Examples

```sh
# Show verbose output for specific codemod
npx @mastra/codemod --verbose v1/mastra-core-imports src/

# Print transformed code for specific codemod
npx @mastra/codemod --print v1/mastra-core-imports src/mastra.ts
```

## Contributing

### Adding New Codemods

1. Create the codemod in `src/codemods/<version>`
2. Add test fixtures in `src/test/__fixtures__/`
3. Create tests in `src/test/`
4. Use the scaffold script to generate boilerplate:

   ```sh
   pnpm scaffold
   ```

### Testing Codemods

First, navigate to the codemod directory:

```sh
cd packages/codemod
```

Then run the tests:

```sh
# Run all tests
pnpm test

# Run specific codemod tests
pnpm test mastra-core-imports

# Test in development
pnpm test:watch
```
