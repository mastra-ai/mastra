---
'@mastra/factory': minor
---

Every GitHub issue and pull request now arrives in Intake, and a card enters a working lane only when a run actually starts on it.

Before, a maintainer's pull request was born in Reviewing with nothing reviewing it, and a contributor's sat in Intake with no sign a review was even possible. Trust moved out of the column layout and onto the card: arrivals are stamped with whether the Factory may pick them up on its own, an **External** mark shows pull requests from authors without write access, and a card whose review the Factory would start shows that as a suggestion you can release with a click.

Reviewing now means a review is running. An external pull request is still never started on its own.

Moving a card back to Intake, Done or Canceled now parks it: a running session is told the work moved, and nothing is opened for a card nobody is working on. Before, dragging a card to Intake opened a session to deliver that notice, which started a run and bounced the card straight back out. Starting a run also no longer re-asks the lane it lands in for a second one.
