---
'@mastra/core': patch
---

Fixed experiments ignoring stored scorers (scorers created in Studio or through the editor) when they were selected for the whole experiment (including workflow step scorers) or set on the dataset. Previously these scorers only ran if something in the same process had already loaded them, so durable experiments running on a worker usually finished without scores. Stored scorers are now loaded on demand at every level.

Starting or creating an experiment with a scorer id that does not exist now fails immediately with `EXPERIMENT_SCORER_NOT_FOUND`, before the experiment is created, instead of failing later during the run.

If a scorer disappears after the experiment has started (for example, a stored scorer is deleted mid-run) or a dataset's scorer id can't be found, only the items that use it fail, with `EXPERIMENT_ITEM_SCORER_NOT_FOUND` recorded on the result. Other items keep running and the experiment completes.

A scorer lookup that fails for another reason, such as storage being unavailable, now surfaces that error instead of being reported as an unknown scorer id.
