---
'@mastra/factory': minor
'mastra': patch
---

Factory app skills can live in `src/mastra/factory-skills/<name>/SKILL.md`, next to the rest of your Mastra code, instead of under `src/mastra/public/factory-skills`. `mastra dev` reads the folder directly and `mastra build` copies it into the build output. The `public/` folder still works; when both exist, `src/mastra/factory-skills` wins.
