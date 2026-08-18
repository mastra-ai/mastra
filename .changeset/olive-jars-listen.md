---
'create-factory': patch
---

A new project now states which identity provider it resolved to at boot, instead of leaving it to be guessed. With no WorkOS variables set, sign-in defers to Mastra's hosted platform — that has always been the default, but nothing said so, so a local dev server looked self-contained while it was talking to production.

```
[factory] Identity defers to https://platform.mastra.ai/v1 (default).
[Auth] WORKOS_CLIENT_ID is missing, so self-managed WorkOS sign-in is off and identity defers to the Mastra platform instead. Set both variables to use your own WorkOS.
```

The second line is the case that used to be invisible: setting only one of `WORKOS_API_KEY` / `WORKOS_CLIENT_ID` silently kept the platform default, so a project that had asked for self-managed WorkOS authenticated its users elsewhere and only failed later with an unrelated-looking redirect error.

Behavior is unchanged in every case, and `.env.example` now spells out that "no WorkOS variables" is not the same thing as "auth disabled".
