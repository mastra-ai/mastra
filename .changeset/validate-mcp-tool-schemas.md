---
"@mastra/mcp": patch
---

Validate and sanitize MCP tool input schemas before passing to `createTool()`. Some MCP servers send malformed JSON schemas (e.g., `required` nested inside `properties` instead of at object level), which causes LLM providers to reject the entire tools array with a 400 error.

This fix adds basic schema validation that catches common issues and provides helpful error messages, preventing one bad tool from breaking an entire conversation.
