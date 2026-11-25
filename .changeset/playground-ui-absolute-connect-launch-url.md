---
'@mastra/playground-ui': patch
---

Fixed the Connect card opening a broken popup when the server returns an absolute `launchUrl`. A server behind a proxy can only return the public address of its launch gate, so the card now opens an absolute launch URL as it is and resolves only a path against the client's base URL.
