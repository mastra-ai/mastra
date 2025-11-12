# Template Sync Scripts

This directory contains scripts for syncing templates from the monorepo to individual template repositories.

## Scripts

### `sync-templates-local.js`

A local version of the template sync script that you can run manually. This is useful when you need direct control over which branch to sync to.

#### Prerequisites

1. **GitHub Personal Access Token**: You need a token with `repo` scope
   - Create one at: https://github.com/settings/tokens
   - Or use: `gh auth token` if you have GitHub CLI installed

2. **Node.js**: Version 18 or higher

#### Usage

```bash
# Set your GitHub token
export GITHUB_TOKEN=your_github_token_here

# Sync to main branch (default)
node .github/scripts/sync-templates-local.js main

# Sync to beta branch
node .github/scripts/sync-templates-local.js beta

# Or use GitHub CLI to auto-set token
GITHUB_TOKEN=$(gh auth token) node .github/scripts/sync-templates-local.js main
```

#### Options

- **Branch argument**: The target branch to sync to (default: `main`)
- **Environment variables**:
  - `GITHUB_TOKEN`: Your GitHub personal access token (required)
  - `ORGANIZATION`: GitHub organization (default: `mastra-ai`)

#### What it does

1. For each template directory in `templates/`:
   - Clones the corresponding repository (e.g., `mastra-ai/template-weather-agent`)
   - Checks out the target branch (creates it if it doesn't exist)
   - Clears all existing content (except `.git`)
   - Copies all files from the monorepo template
   - Commits and pushes changes

2. Provides detailed logging and a summary of:
   - Successfully synced templates
   - Templates with no changes
   - Failed templates with error messages

#### Example Output

```
📝 [2025-01-12T10:00:00.000Z]
============================================================
📝 [2025-01-12T10:00:00.000Z] 🚀 Mastra Template Sync - Local Version
📝 [2025-01-12T10:00:00.000Z] ============================================================
📝 [2025-01-12T10:00:00.000Z] Target branch: main
📝 [2025-01-12T10:00:00.000Z] Organization: mastra-ai
📝 [2025-01-12T10:00:00.000Z] Templates directory: /Users/you/mastra/templates
📝 [2025-01-12T10:00:00.000Z] ============================================================

📝 [2025-01-12T10:00:00.000Z] Found 13 templates to sync:
  - template-weather-agent
  - template-browsing-agent
  ...

============================================================
📝 [2025-01-12T10:00:00.000Z] Syncing template: template-weather-agent
============================================================
✅ [2025-01-12T10:00:00.000Z] Successfully synced template-weather-agent to main branch

...

============================================================
📝 [2025-01-12T10:00:00.000Z] 📊 Sync Summary
============================================================
📝 [2025-01-12T10:00:00.000Z] Total templates: 13
✅ [2025-01-12T10:00:00.000Z] Successfully synced: 13
⚠️  [2025-01-12T10:00:00.000Z] No changes: 0
📝 [2025-01-12T10:00:00.000Z] Failed: 0
============================================================
```

### `sync-templates.js`

The CI/CD version that runs in GitHub Actions. This script:

- Runs automatically when templates are changed in the monorepo
- Uses GitHub App authentication
- **Now syncs to the `beta` branch** for v1.0 beta release

When the beta is stable and ready for production, this script should be updated to sync to `main` branch instead.

### `update-templates-to-model-router.js`

A one-time migration script that updates all templates to use the model router pattern:

- Updates agent files to use `process.env.MODEL || 'provider/model'`
- Removes provider-specific dependencies
- Updates `.env.example` files with MODEL variable
- Updates README files

This script has already been run and the changes are staged in git.

## Workflow

### For Beta Release (Current)

1. **Update templates locally**:

   ```bash
   # Make changes to templates in templates/ directory
   git add templates/
   git commit -m "feat: update templates"
   ```

2. **Sync to main branch** (for stable release):

   ```bash
   GITHUB_TOKEN=$(gh auth token) node .github/scripts/sync-templates-local.js main
   ```

3. **Sync to beta branch** (for beta testing):

   ```bash
   GITHUB_TOKEN=$(gh auth token) node .github/scripts/sync-templates-local.js beta
   ```

4. **Push monorepo changes**:
   ```bash
   git push
   ```

### After Beta is Stable

Once the beta release becomes stable:

1. Update `.github/workflows/sync-templates.yml` to sync to `beta` branch only
2. Use GitHub Actions for automatic beta syncing
3. Continue using local script for main branch syncing when needed

## Troubleshooting

### Permission Denied

Make sure your GitHub token has `repo` scope and you have write access to the template repositories.

### Branch Already Exists Error

The script automatically handles existing branches. If you see this error, it might be due to local git conflicts. The script uses temporary directories, so try running it again.

### Template Repository Doesn't Exist

The script assumes all template repositories already exist in the organization. If a repository doesn't exist, you'll see an error. Create the repository first:

```bash
gh repo create mastra-ai/template-name --public
```

## Best Practices

1. **Test first**: Sync to beta branch first to test changes before syncing to main
2. **Commit first**: Always commit your template changes to the monorepo before syncing
3. **Review changes**: Check the GitHub UI to verify the synced changes look correct
4. **One branch at a time**: Don't sync to multiple branches simultaneously
