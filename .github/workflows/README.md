# GitHub Workflows

This directory contains GitHub Actions workflow files for the Mastra project.

## Preventing Workflows from Running on Forks

To prevent workflows from running on forked repositories, we've added a condition to each workflow file that checks if the repository is the main Mastra repository:

```yaml
if: ${{ github.repository == 'mastra-ai/mastra' }}
```

If a job already has an `if` condition, we combine them:

```yaml
if: ${{ github.repository == 'mastra-ai/mastra' && (your existing condition) }}
```

## Benefits

- Prevents unnecessary workflow runs on forks
- Reduces notifications for fork owners
- Saves GitHub Actions minutes
