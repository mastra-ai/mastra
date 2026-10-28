---
'@mastra/factory': patch
---

More failed-run cards in the Factory web chat now come with a button that fixes them:

- **Request timed out**, **Provider rate limit reached** and **Model provider temporarily unavailable** offer **Continue**, which resumes the run without typing a message. It only appears on the session's latest failure.
- **Provider rate limit reached** also offers **Review credentials** and **Change model**, and **Model provider temporarily unavailable** offers **Change model**.
- **Model request rejected** and **Model request failed** offer **Change model**.
- **Conversation exceeds the model's limit** and **Conversation history rejected** offer **New session**.

In Slack, every card that offers **Change model** in the web chat now links to the session, and the rate-limit card also links to the credential settings.
