---
'@mastra/libsql': minor
'@mastra/pg': minor
---

Added `agentAvatars` storage domain implementations (`AgentAvatarsLibSQL`, `AgentAvatarsPG`) backing the new `mastra_agent_avatars` table, so agent avatars persisted through the default `StorageAvatarStore` are durable in LibSQL and PostgreSQL deployments.
