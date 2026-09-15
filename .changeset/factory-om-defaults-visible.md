---
'@mastra/factory': patch
---

Factory setup now says which observational-memory model a provider pick seeds for Factory runs, the Models settings page lists the Observer and Reflector models next to the Factory default model with a link to the Factory-wide Memory settings, and a board card whose run the provider rejected names the memory model as the cause, links to those settings from its error, and keeps Retry as a fallback in place of the lane button. Saving a new Factory-wide memory model re-queues the runs of that factory the refused model killed, so the board resumes without a Retry per card; the dispatcher never redelivers such a run on its own. A Factory-wide memory change now reaches Factory runs that are already live, so the next observation in an open review or work thread uses the new model without a restart. A run's session reopened after a restart follows the Factory-wide memory model again instead of the opener's personal one.
