---
'mastra': patch
---

Made `mastra traces import` easier to read: the destination flag is now `--target-project` and the date window flags are `--since` and `--until` (the old `--project`, `--from`, and `--to` still work), the summary names the source Langfuse project, and the printed resume command uses the project name you typed. Imported agent, tool, and evaluator spans now show their primitive type and name in Mastra Platform, and Langfuse's placeholder `default` environment is no longer copied, so imported traces show up in Mastra Studio without changing the environment filter.
