# @internal/changeset-cli

Custom changeset CLI for managing versioning and changelogs in the Mastra monorepo. This tool provides an interactive interface for creating changesets with automatic detection of modified packages and intelligent version bump suggestions.

## Features

- **Automatic change detection** - Identifies packages that have been modified since the last release
- **Interactive version selection** - Choose between major, minor, and patch version bumps for each package
- **Peer dependency management** - Automatically updates peer dependencies across the monorepo
- **CLI arguments support** - Specify version bumps directly via command line flags

## Installation

This package is internal to the Mastra monorepo and is installed as part of the workspace dependencies:

```bash
pnpm install
```

## Usage

### Interactive Mode

Run the CLI interactively to select version bumps for changed packages:

```bash
pnpm start --filter=@internal/changeset-cli
```

The CLI will:

1. Detect all packages with changes since the main branch
2. Prompt you to select version bump types (major/minor/patch)
3. Open your default editor for writing the changeset message
4. Update peer dependencies automatically
5. Create the changeset file in `.changeset/`

### Command Line Arguments

Skip the interactive prompts by specifying version bumps directly:

```bash
# Specify version bumps for specific packages
pnpm mastra-changeset --major @mastra/core --minor @mastra/cli --patch @mastra/memory

# Add a custom message
pnpm mastra-changeset --message "Breaking changes to core API" --major @mastra/core

# Skip all prompts (auto-patch all changed packages)
pnpm mastra-changeset --skipPrompt
```

### Options

| Option         | Alias | Description                                      |
| -------------- | ----- | ------------------------------------------------ |
| `--message`    | `-m`  | Changeset message (opens editor if not provided) |
| `--skipPrompt` | `-s`  | Skip interactive prompts and use defaults        |
| `--major`      |       | Package(s) to bump major version                 |
| `--minor`      |       | Package(s) to bump minor version                 |
| `--patch`      |       | Package(s) to bump patch version                 |

## How It Works

### Change Detection

The CLI uses git to identify packages that have been modified compared to the `main` branch:

1. Compares current branch against `origin/main` (or `main` if remote unavailable)
2. Filters for public packages only (excludes private packages)
3. Groups changes by package directory

### Version Bump Logic

- **Major (x.0.0)**: Breaking changes that require consumers to update their code
- **Minor (0.x.0)**: New features that are backwards compatible
- **Patch (0.0.x)**: Bug fixes and minor improvements

If no explicit version bump is specified, changed packages default to patch bumps.

### Peer Dependency Updates

After selecting version bumps, the CLI:

1. Scans all packages for peer dependencies on bumped packages
2. Updates peer dependency version ranges to match new versions
3. Includes these updates in the changeset summary

### Changeset Generation

Creates a changeset file in `.changeset/` with:

- List of packages and their version bump types
- User-provided summary message
- Properly formatted for the Changesets workflow
