---
'@mastra/factory': minor
---

Every GitHub issue and pull request now arrives through Intake, and cards enter working lanes only when work starts on them. Arrivals are stamped with whether the Factory may pick them up on its own (trusted or Factory-authored, fresh at open), so Reviewing means a review actually ran instead of maybe someday.

Added a Plan review setting next to Auto-start runs. On, started work pauses at its written plan until someone approves it, and a waiting plan shows up in Needs attention instead of hanging silently in the thread. Off, plans are approved automatically and work carries through to Done.

Governed stage moves no longer park unattended runs behind an approval prompt nobody can see, and an item's autonomy now expires at Done or Canceled so re-opened work asks again before running.
