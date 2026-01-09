---
'@mastra/dynamodb': patch
---

Fix eval scores not being saved when using DynamoDB storage
Scores from built-in scorers (like hallucination-scorer) were silently failing to save to DynamoDB. Scores now persist correctly with all their metadata.
Fixes #11693. Add metadata field coverage to score storage tests
