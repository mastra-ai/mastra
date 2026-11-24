---
'@mastra/evals': patch
---

Fixed the tone scorer so every sentence counts toward the stability score. A last sentence with no final punctuation was skipped, and line breaks did not separate sentences, so a reply that turned negative at the end could still get a high score. A one- or two-word ending with no final punctuation, such as `Thanks`, has a lower weight.
