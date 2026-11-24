# AGENTS.md

## CRITICAL: Load `mastra` skill first

Load the `mastra` skill BEFORE any Mastra work. Never rely on cached knowledge — APIs change between versions.

## Rules

- Register all agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Use the `dev` and `build` scripts from `package.json` instead of running `mastra dev` / `mastra build` directly
- `DATABASE_URL` (Postgres) is required to boot; platform env (`MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID`) is optional and unlocks Connect tools and channels

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
