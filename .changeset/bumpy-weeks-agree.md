---
'@mastra/factory': patch
---

Fixed the audit log filters: the Worktrees tab was always empty and intake binding changes were hidden.

The Audit page listed its filter tabs by hand, and the list had drifted from what the Factory actually records. Worktrees filtered on two actions nothing has ever emitted, so the tab could only ever come back empty; meanwhile intake binding updates were recorded but named in no tab, so changing which repository or project an intake source is bound to never showed under Intake.

The action taxonomy is now declared once, in AUDIT_ACTIONS, and recording an event is typed against it. The page derives its tabs from that list, so a tab can no longer sit permanently empty and a recorded action can no longer hide from every tab. Emitting an action that is not in the list is a type error, which is the point: the WorkOS export mirror drops actions it has not been told about.
