---
'@mastra/factory': patch
---

Fixed credential-vault session isolation. Factory refuses source-control operations when sandbox mode is unknown, allows GitHub Vault pushes without acquiring repository tokens, and releases the previous owner’s Vault sandbox before transferring ownership. Failed release keeps ownership unchanged, including on retries. Confirmed non-Vault sessions retain their existing behavior.
