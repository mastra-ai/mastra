---
'@mastra/core': patch
---

`knowledge_search` handles queries agents commonly write. Quoted words (`"api" "responses"`) are searched as plain words; before, the quote marks were matched literally and nothing was found. A search that finds nothing now says so and suggests one to three key words or `knowledge_list`. Passing a page ref such as `docs:acme#models` as `scope` now explains that `scope` takes scope addresses, instead of reporting the page as not found.

A first `knowledge_read` of a long page that stops early now also returns the `outline` of the headings it did not reach (up to about 500 tokens of them, with their line numbers and sizes), so an agent can read the section it needs next instead of paging toward it. Search results at their limit no longer tell the agent to search again; the default Knowledge instructions now say to follow `more` only when what the agent needs is not already in what it has read, and to answer once it has it.
