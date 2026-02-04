## Current setup for generating embedded docs

I want to update how we generate the embedded docs for our packages. I'll explain what we do with an example package: `@mastra/mcp`. It lives at `packages/mcp`.

It has a `build:docs` script in its `package.json` that will execute @scripts/generate-package-docs.ts. The @packages/mcp/turbo.json file defines that this will be run during the `build` phase.

What this script is doing can be seen in @packages/mcp/dist/docs. It creates a `docs` folder inside `dist` and generates markdown files and a `SOURCE_MAP.json`. It also creates a `SKILL.md` file. The markdown files are

## What I want to change

- The @docs/ now generate a @docs/build/llms-manifest.json file that contains the mapping between package names and their relevant docs files. They are inside the `build` folder, too. For example: @docs/build/docs/agents/adding-voice/llms.txt
- The @scripts/generate-package-docs.ts should use this manifest and the generated llms.txt files to create the embedded docs for each package.
- The script should rename the llms.txt to markdown files
- IMPORTANT: The script should create a valid Agent skill (read: https://agentskills.io/specification) for each package inside the `dist/docs` folder. Currently, it creates a SKILL.md file but that file and the rest of the folder is not valid to the skill specification.
- The @scripts/generate-package-docs.ts uses a weird way of creating the SOURCE_MAP.json file. We already have files like @packages/mcp/dist/index.js.map that are source maps. We should leverage those instead of creating a new file that maps everything again.
- The SOURCE_MAP.json should be stored in `dist/docs/assets` according to the agent specification
- The generated markdown files should be stored in `dist/docs/references`
- The generated markdown files should be a flat structure, not nested folders. We need to come up with a good naming scheme to avoid name collisions and make it easy for the agent to find the right file. For example: `agents-adding-voice.md` instead of `agents/adding-voice.md`