---
'@mastra/factory': minor
---

Redesigned board settings in the Factory UI as one canvas. Before, phases, rules and card moves each had their own page. Now the board's name and description head the page as its title, edited where they're shown, with Reset and Delete in the menu beside the name. Below, the board's phases run top to bottom, and each rule sits beside the phase it files items into, with a line into that phase's card and how many items it filed in the last 30 days. Clicking a phase or a rule opens it in a side panel. Phases and the side panel are wide enough to read rule names and moves in full, and the links between cards meet at ports on their edges and round their corners. The links stay quiet in dark mode, and the Routing tab draws its links the same way. The canvas centers on the page and only slides aside as far as it must when the side panel opens, so it no longer scrolls sideways when it fits.

**Rules**

- A rule's panel shows its trigger, its conditions and where it sends items as editable cells, plus the order it's checked in with the other rules on that trigger.
- The canvas dims a rule that a rule above it always beats, and marks a phase no rule leads to.
- Pointing at a numbered rule lights the other rules on its trigger, and its tooltip names the rules checked before it.
- A new rule waits for you to pick a phase instead of defaulting to the board's first one.
- Add a rule from the "+ Rule" that shows beside a phase when you point at it. The rule starts out filing items into that phase.
- The Routing tab orders the boards and their rules for new items and lists what wasn't routed. Each board there links to all its rules.
- At the top of the canvas, a "New issues and pull requests" card says where the board stands in the intake order. A line runs from it to every trigger new items arrive on, so you see which rules they reach and in which phases they land. Triggers wear the same icons on the canvas and in the Routing tab.

**Phases**

- Phase edits share one draft with a save bar. Leaving with unsaved changes asks first. The phase panel shows its sections as steps joined by a line, in the order a card goes through them.
- A phase's "Only when" conditions for starting and approving use the same condition cells as rules. The JSON editor for them is gone.
- Dragging a phase, or a board in the Routing tab, moves the others aside as you drag, so you see the new order before you drop.
- Add a phase from the "+ Phase" button that shows halfway along the link between two phases when you point at it, or below the last one. You name it in a card right where it will stand, in place of the old dialog.

**Testing**

- Paste an issue or pull request URL into the bar at the bottom. The canvas lights the rules and phases it went through, and the side panel explains each step.

**On a phone**

- The canvas runs in one column as wide as the screen. Each phase's rules sit above its card, and the links run down the left edge. The view tabs scroll away with the flow.
- A phase, a rule or a test opens in a bottom sheet over the toolbar. Swipe it down to close it.
- "+ Rule" and "+ Phase" always show, since there's no pointer to bring them up.
- The Routing tab stacks its sources above the intake order.

Links to the old rules and card-move pages now open the canvas.
