---
'@mastra/core': patch
---

The built-in `web_fetch` tool now works on Cloudflare Workers. Previously every request failed with "The options.lookup option is not implemented". When Node's request API isn't available, the tool now uses `fetch` instead. It still checks every URL and redirect target for `localhost` and private or reserved IP addresses, and keeps the 5-redirect limit, the 100,000-character truncation, and the 15-second timeout. On Workers it can't check the address a hostname resolves to, so a public hostname that points to a private address isn't blocked.
