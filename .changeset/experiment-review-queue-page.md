---
'mastra': minor
---

Added a **Review Queue** page to Studio under Evaluation → Experiments. Pick an experiment from the combobox (or deep-link with `/experiments/review-queue?experiment=<id>&review=<resultId>`) to review its flagged results.

The experiment detail page now shows only Results. Existing `/experiments/:id?review=<resultId>` links, including those from the Inbox, redirect to the new page.
