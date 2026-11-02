---
'@mastra/core': patch
---

`knowledge_search` handles queries agents commonly write. Quoted words (`"api" "responses"`) are searched as plain words; before, the quote marks were matched literally and nothing was found. A search that finds nothing now says so and suggests one to three key words or `knowledge_list`. Passing a page ref such as `docs:acme#models` as `scope` now explains that `scope` takes scope addresses, instead of reporting the page as not found.
