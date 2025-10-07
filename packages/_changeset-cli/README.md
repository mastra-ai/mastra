# Mastra Changeset CLI

Custom changeset CLI for managing versioning in the Mastra monorepo, built on top of official Changeset tools.

## Project Structure

The CLI is organized into modular, single-purpose functions grouped by domain:

```
src/
├── index.js                     # Main entry point and orchestration
├── config.js                    # Shared configuration and constants
├── changeset/                   # Changeset-related operations
│   ├── createAdditionalChangeset.js  # Generate changesets for peer deps
│   ├── createCustomChangeset.js      # Create changeset with user message
│   ├── getAllVersionBumps.js         # Parse changeset files
│   ├── getChangesetMessage.js        # External editor for changeset message
│   └── promptForVersionBumps.js      # Interactive version bump selection
├── git/                         # Git and repository operations
│   └── getChangedPackages.js         # Detect changed packages using @changesets/git
├── pkg/                         # Package.json operations
│   ├── getPackageJson.js             # Read package.json files
│   └── updatePackageJson.js          # Write package.json files
├── ui/                          # User interface
│   └── displaySummary.js             # Display final summary
└── versions/                    # Version management
    ├── bumpVersion.js                 # Calculate new version numbers
    ├── compareBumpTypes.js            # Compare bump type priorities
    └── updatePeerDependencies.js     # Handle peer dependency updates
```

## Features

- Uses `@changesets/git` to accurately detect changed packages by comparing to main branch
- Interactive version bump selection with `@clack/prompts`
- **External editor support** for composing changeset messages
- Automatically updates peer dependencies when core is bumped
- Handles minor version bumps with appropriate peer dependency ranges
- Creates additional changesets for packages that need bumps due to peer dep updates
- Provides a comprehensive summary of all changes

## Usage

From the monorepo root:

```bash
# Run the CLI
pnpm --filter @internal/changeset-cli start

# Or run directly
node packages/_changeset-cli/src/index.js

# Skip interactive prompt (useful for CI)
node packages/_changeset-cli/src/index.js --skip-prompt

# Skip external editor for changeset message
node packages/_changeset-cli/src/index.js --skip-editor

# Or use the runner script
./packages/_changeset-cli/run.sh
```

## How it works

1. **Change Detection**: Uses `@changesets/git` to find all changed packages since main branch
2. **Version Selection**: Interactive prompts for selecting which packages to bump and their version types
3. **Message Composition**: Opens external editor for writing a comprehensive changeset message
4. **Changeset Generation**: Creates changeset files with version bumps and user message
5. **Peer Dependency Updates**:
   - If `@mastra/core` is bumped, updates all peer dependencies accordingly
   - For minor bumps: Updates peer deps to `^major.minor.0` and adds patch bumps to affected packages
   - For major bumps: Updates peer deps to new major version
   - Automatically creates additional changeset files for packages needing bumps
6. **Summary**: Displays all changes, version bumps, and updated dependencies

## Peer Dependency Rules

- **Major bump of core**: All packages with core peer dep get updated to new major version and receive a patch bump
- **Minor bump of core**: All packages with core peer dep get updated to `^major.minor.0` range and receive a patch bump
- **Patch bump of core**: Peer dependency ranges remain compatible, no additional bumps needed

## Workflow Integration

This CLI is designed to work with the standard changeset workflow:

1. Make changes to packages
2. Run this CLI to create changesets and update dependencies
3. Commit the changeset files
4. CI/CD can use these changesets for releasing
