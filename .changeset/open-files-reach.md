---
'@mastra/mcp': patch
---

MCP tools that declare an `outputSchema` now pass the text of embedded `resource` blocks to the model, together with their text blocks. Before, only the text blocks reached the model, so tools such as GitHub's `get_file_contents` showed the model a status line but not the file. `structuredContent` is still kept out of the model input.
