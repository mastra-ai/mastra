# Platform Memory + LangChain

`PlatformChatMessageHistory` plugs hosted Platform Memory into `RunnableWithMessageHistory`.
History is the instance's observations plus the recent unobserved messages, so it stays bounded.

```sh
export MASTRA_PLATFORM_ACCESS_TOKEN=...   # Platform access token for the project
export MASTRA_MEMORY_INSTANCE_ID=...      # Memory instance id
export OPENAI_API_KEY=...
pnpm install
pnpm start user-ada "Hi, I'm Ada and I just moved to Kyoto."
pnpm start user-ada "Where do I live?"
```
