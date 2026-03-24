---
'@mastra/schema-compat': patch
---

Split provider-compat test suite into universal and OpenAI-specific suites. Tests for null-to-undefined transforms, default value application, and allPropsRequired strict mode now only run for OpenAI-based providers (openai, groq). Non-OpenAI providers (anthropic, deepseek, google, meta) and openai-reasoning run only universal tests.
