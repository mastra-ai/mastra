---
'@mastra/code-sdk': patch
'mastracode': patch
---

Added multiple OAuth accounts per provider. Sign in with as many accounts per provider as you like. Running `/login` on an already-connected provider opens an account manager. There you can add another account, switch the active one, re-authenticate, or remove accounts. Added accounts stay inactive until you select one. Accounts carry labels — email for ChatGPT/xAI, GitHub login for Copilot. Credentials keep the same `auth.json` slot format, so existing setups are untouched.

Account ids are assigned once, when an account is first registered, and no longer derived from the refresh token — so refreshing a token or re-authenticating an account no longer changes which account it is, and adding an account you already have updates it instead of registering a duplicate for the same subscription. Existing `auth.json` files are read as-is; registered accounts additionally learn their provider's stable account identifier on next load, where the provider exposes one.

Add and select accounts from `/login`:

```text
/login               # choose a provider you are already signed in to
Add another account  # sign in again; the new account is registered but inactive
Set as active        # make an added account the one new requests use
```
