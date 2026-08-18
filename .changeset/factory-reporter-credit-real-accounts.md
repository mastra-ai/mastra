---
'@mastra/factory': patch
---

Only credit reporters who are real GitHub accounts

The issue poller stamps a placeholder login when GitHub returns no author, which
would have become a `Co-Authored-By` trailer crediting an account nobody owns.
Reporter credit now requires a login that matches GitHub's grammar.
