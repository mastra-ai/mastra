---
'@mastra/factory': minor
---

Added personal custom providers. A custom OpenAI-compatible endpoint is now saved either for yourself or for your organization, the same way provider API keys are.

- **Personal endpoints** are visible only to you and are used by your personal sessions.
- **Organization endpoints** are used by work that runs on the organization's credentials. Adding, editing or removing one now requires an organization admin.
- Custom endpoints are added from the **Add provider** dialog and listed with the other providers. The separate "Custom providers" section is gone.
- Editing an endpoint without retyping its API key keeps the saved key, as long as the URL stays on the same host. Moving it to another host asks for the key again.
- Adding an endpoint under a name that is already in use is refused instead of replacing the existing one. So are names reserved for a built-in provider, its sign-in, or the Mastra Gateway (for example "OpenAI", "OpenAI Codex" or "Mastra Gateway").
- A Factory hosted on the Mastra platform only calls custom endpoints at a public HTTPS address. Saving one on plain HTTP, `localhost`, a private network or the cloud metadata address is refused with a message explaining why. Local and self-hosted Factories can still use endpoints on their own machine or network, such as Ollama or vLLM.

**Before you upgrade**

- Organization endpoints no longer apply to personal sessions. Add the endpoint again as a personal one to keep using it there.
- On a hosted Factory, endpoints saved earlier on a local or plain-HTTP address are marked "URL not allowed" and their models are no longer offered. Edit them to a public HTTPS address.
- Review your organization's endpoints. One named like a built-in provider (for example "OpenAI") still takes over that provider's models; remove it or rename it.

The custom provider routes take a `scope` (`user` by default, or `org`). Saving with `previousId` edits that provider; saving without it adds one:

```http
POST /web/config/custom-providers
{ "name": "My gateway", "url": "https://llm.example.com/v1", "models": ["my-model"], "scope": "org" }

DELETE /web/config/custom-providers/my-gateway?scope=org
```
