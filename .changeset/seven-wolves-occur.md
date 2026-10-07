---
'@mastra/livekit': minor
---

Fixed recording URL validation so malformed URLs produce validation failures without throwing unexpected exceptions. Playback remains limited to HTTP and HTTPS URLs.

Aligned the Zod peer range with LiveKit Agents: `^3.25.76 || ^4.1.8`. Older Zod versions are no longer accepted. Upgrade before installing this release:

```sh
npm install zod@^3.25.76
# Or use Zod 4:
npm install zod@^4.1.8
```
