---
'@mastra/factory': minor
---

Added support for several subscriptions of one provider per member. In Settings, a connected Claude Pro/Max, ChatGPT, GitHub Copilot or SuperGrok row now offers **Add another account**. Each account gets its own row, labelled with the account name the provider shares (an email for ChatGPT and SuperGrok), with its own **Sign in again** and **Remove account**.

When one subscription hits its rate limit or quota, the next request moves to the member's next subscription of that provider before falling back to another model, and the transcript says which account it switched to. Members with one subscription see no change.
