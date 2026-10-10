# Platform Memory + AI SDK

Hosted Platform Memory for an AI SDK app via `wrapLanguageModel`. Each call sends only the new
message; earlier turns and observations come from memory.

```sh
export MASTRA_PLATFORM_ACCESS_TOKEN=...   # Platform access token for the project
export MASTRA_MEMORY_INSTANCE_ID=...      # Memory instance id
export OPENAI_API_KEY=...
pnpm install
pnpm start user-ada "Hi, I'm Ada and I just moved to Kyoto."
pnpm start user-ada "Where do I live?"
```
