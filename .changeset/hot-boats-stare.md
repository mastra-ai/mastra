---
'@mastra/core': minor
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'@mastra/slack': patch
'mastra': patch
---

Stream agent text deltas to channels (Slack/Discord/etc.) via Chat SDK StreamingPlan with graceful buffered fallback. Added typing status updates that change based on agent activity (Thinking… while reasoning, Typing… while generating text, Using {tool}… during tool calls). Fixed logger propagation from Agent to AgentChannels so channel logs now flow through the configured logger.
