---
'@mastra/factory': minor
---

Board lanes now mean engagement: a card enters a working lane only when a run starts on it or a person moves it there, and resting a card takes the Factory's hand off it.

Every GitHub issue and pull request arrives in Intake. Trust moved out of the column layout and onto the card: arrivals are stamped with whether the Factory may pick them up on its own, an **External** mark shows cards the execution gate treats as externally authored, and a card whose run the Factory would start shows that as a suggestion you can release with a click. Reviewing means a review is running — before, a maintainer's pull request was born there with nothing reviewing it.

Consent follows the same line. A person's drag into a working lane hands the Factory the work; any entry into Intake, Done or Canceled takes it back, whoever rested the card — a verdict, a mirrored close, a drag. The close-out run a resting transition queued still fires, pre-approved by the transition that committed it. An external event can no longer pull a rested card back into a working lane or start a run on it without a person's consent, and a card from an author without write access never self-starts — even armed, even with auto-run on. A GitHub card missing its trust stamp — created before stamps existed — fails closed and asks too. The reconcile sweep keeps the stamp current in both directions: it backfills missing stamps and withdraws trust from authors whose write access was revoked, each within one sweep cycle (a few minutes by default); the Factory's own pull requests count as trusted through their authorship.

A card parked in Intake offers Resume as its primary action, re-entering the deepest seat it used, and asking the card's agent in chat to resume does the same through the governed transition. Dragging a card out no longer opens a session just to say so: the stop notice reaches whichever session is live on the card, or nobody. A run landing its card in a lane no longer dispatches a second run.
