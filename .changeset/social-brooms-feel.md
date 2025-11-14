---
'@mastra/mcp-docs-server': patch
'mastra': patch
'@mastra/playground-ui': patch
---

Templates now don't dynamically create a branch for every provider, each template should be agnostic and just use a env var to set the models until the user wants to set it otherwise.
MCP docs server will install the beta version of the docs server if they create a project with the beta tag.
Updates to the templates now will get pushed to the beta branch, when beta goes stable we will merge the beta branch into the main branch for all templates and update the github script to push to main.
Templates have been cleaned up
small docs updates based off of how the template migrations went
