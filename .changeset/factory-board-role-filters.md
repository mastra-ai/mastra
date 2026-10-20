---
'mastra': patch
---

You can now filter Factory boards by **Author**, **Assignee** and, on the Review board, **Review requested**. **Involves** (formerly Teammate) and **Worked on by** remain available. Picks within one people field match any of them, and different fields must all match, so "Author: Alice" plus "Assignee: Bob" shows only Alice's cards that Bob is assigned to. **Label** still needs every picked label.

- **You** comes first in every people list and also matches the cards you opened from your GitHub account.
- People and label lists longer than eight entries get a search box.
- **Linear project** shows up only once Linear is picked as an intake source. It now narrows only Linear cards, so other picked sources such as GitHub stay visible.
- Hovering Board properties lists the filters in use.

**Relevant because** is removed. Board links and saved views that used it now show every card involving the picked teammate. To narrow by role again, pick the person in the matching field: Teammate "Alice" with Relevant because "Assigned" becomes Assignee "Alice".
