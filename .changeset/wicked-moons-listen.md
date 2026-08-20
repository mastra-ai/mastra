---
'@mastra/factory': minor
---

Added a Traces page to the Factory: one row per card, drawn on a real time axis, so you can see where the work actually sat.

Every readout before it was a total. "Median lead time 32m" does not tell you that one card spent two days in review while eleven others went through in minutes. A trace does: the row's length is elapsed time, each colour is a stage, and a row that runs one colour to the right edge is a card nobody picked up. The faded lead-in before the first coloured stage is the time the card sat filed and untouched.

A backwards curve is a card that had to be redone — sent from review back to building. A filled dot is a card that shipped, a cross is one that was canceled, and a haloed dot on the NOW line marks work still open right now. The band underneath stacks every row into how many cards the board was holding at each moment, so a queue that built up over a weekend reads as a shape instead of a number.

Hovering a row — or tabbing to it, or clicking to pin it — opens what the bar cannot draw: how long it has held its current stage, how long it has been in the factory at all, and how many times it came back. Hovering a single stage adds what that stay cost.

Pick the window with the 24 hours / 7 days / 30 days control. Cards that never moved inside it are left out rather than drawn as empty rows — an empty row reads as a card that stalled, which is the opposite of a card the factory never started on. Those are counted on the Overview instead.

Run failures are not drawn: nothing records when a run ended or how it went, only that one started, so a broken run and a finished one look identical from here.
