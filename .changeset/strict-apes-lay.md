---
'@mastra/core': patch
---

Fixed DurableAgent delegation gaps where inherited Agent methods read unpopulated private fields instead of delegating to the wrapped agent. Added comprehensive overrides for 39 methods including processor listing, metadata, description, workspace, skills, workflows, scorers, sub-agents, background tasks, tracing policy, voice, browser, channels, pubsub, and model accessors. Fixed agentId mismatch where background task events and trace spans used the wrapped agent's ID instead of the durable agent's ID, causing missing traces in Studio and dropped background-task-completed events in streamUntilIdle. Setters (**setMemory, **setPubSub, \_\_setWorkspace) now propagate to both the DurableAgent base class and the wrapped agent.
