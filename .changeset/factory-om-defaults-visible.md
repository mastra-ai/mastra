---
'@mastra/factory': patch
---

Factory setup now says which observational-memory model a provider pick seeds for Factory runs, the Models settings page lists the Observer and Reflector models next to the Factory default model with a link to the Factory-wide Memory settings, and a board card whose run the provider rejected links straight to those settings instead of a dead retry. A Factory-wide memory change now reaches Factory runs that are already live, so the next observation in an open review or work thread uses the new model without a restart.
