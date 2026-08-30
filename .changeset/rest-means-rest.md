---
'@mastra/factory': patch
---

Resting a card now takes the factory's hand off it, whoever rested it.

Any accepted move into Intake, Done or Canceled clears the card's autonomy consent — previously only a human drag out of a working lane did, so an external event landing a card in Done left it armed to restart later. The close-out run that same transition queued still fires: the commit stamps it as pre-authorized, and rule output claiming that stamp for itself is rejected. Two more doors close with it: a transition pushed by an external actor into a working lane now parks for approval when the card is unarmed and auto-run is off, and a card whose author lacks write access never starts a run on its own, even with auto-run on.
