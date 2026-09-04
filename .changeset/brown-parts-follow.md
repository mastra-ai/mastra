---
'@mastra/factory': patch
---

Added a supervisor notification emit path for the Factory. When the health sweep opens or reopens a finding, the Factory now sends a notification signal to that project's supervisor session (creating the session first if it has never been reached) so an idle supervisor wakes up instead of waiting for someone to open the Attention rail. Supervisor-actionable findings (failed or stuck decisions, stalled starts, orphaned or missing seats) wake the supervisor at high priority; findings that wait on a person stay low priority. A notification-woken supervisor turn can now resolve its factory scope from trusted session state and registers the supervisor read tools, where previously it registered none.
