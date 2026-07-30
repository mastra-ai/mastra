---
'@mastra/factory': patch
'@mastra/core': patch
---

Make factory review sessions start fast: `FactoryStartCoordinator.prepare` now records the run with a gated `blocked` kickoff and returns before the sandbox materializes, finishing session creation and kickoff release in the background. Bundled factory-skill kickoff messages resolve from server-local disk without a session, blocked kickoffs stay invisible to the dispatcher until released (with a staleness sweep that fails abandoned ones), and empty factory threads show an honest "Preparing workspace… / Starting the agent…" panel instead of the personal-session hero. `@mastra/core` now exports `WorkspaceSkillsImpl` so hosts can resolve bundled skills without a live workspace session.
