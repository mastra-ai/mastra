---
'@mastra/core': patch
---

Add SambaNova as a model provider (Closes #XXXXX - maintainers: please link the appropriate issue):

- Add SambaNova provider configuration with API endpoint `https://api.sambanova.ai/v1`
- Configure `SAMBANOVA_API_KEY` environment variable for authentication
- Add supported models: Llama-4-Maverick, DeepSeek-V3.1, DeepSeek-R1, Qwen3-32B, and more
- Set `sambanova-ai-provider` as the npm package for the SambaNova AI SDK
