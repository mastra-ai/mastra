---
'@mastra/factory': patch
---

**Session comments panel**

The comments panel opens at half the height of the chat and grows with the conversation up to the full column, instead of opening full height around an empty feed. It morphs open from the workspace card. The composer is a flush bar at the bottom edge and takes focus as the panel opens. A comment that lands while you are watching rises into place. Editing a comment saves on Enter and keeps Shift+Enter for a new line, with Cancel and Save inside the bottom right of the field. The edit field grows with its text up to ten lines, then scrolls, with no resize handle. The workspace card's corners are concentric with the rows inside it. Session rows in the sidebar no longer open their hover details on a touch viewport, where the card could only appear behind the tap that already navigated away.

**Board cards**

A sent comment lands in the feed as soon as the server stores it, with no dimmed placeholder. A failed send keeps the draft and shows the error. Opening a card widens a copy of it over the card, every row anchored where the card had it, and pulls a tray out from beneath, a little narrower than the copy, so opening moves nothing you were about to click. Hovering a card no longer floats its full title over it; the open copy shows it whole.

The tray holds one timeline in time order: the item's runs, moves and comments, with the composer at the bottom. The description heads that stream in a block of its own, an Activity rule between them. The tray opens at its full height whatever the stream holds, waits for the description and the comments together, and lands them one after another, so nothing shifts once it loads.

Cards share a minimum height, with their bottom row pinned to the bottom edge. That row leads with one small button, the likeliest next click: the item's run, Retry after a failure, the suggested run while one waits, Open session while one runs. It lights up only while the card waits on you, to release a suggested run, retry a failure, or answer a session that asked. It goes quiet the moment a run is starting, so a lit button on the board always means your turn. A card in a lane leads with that lane's own run. The other buttons sit tucked under the first like pulled tabs, on the card and in its open copy alike. While a session runs, no rival run is offered beside it. The suggestion itself is a badge in the status row. The last worker sits at the right of the bottom row, the name before the picture, and the External badge sits at the right of its own row above. An expand icon appears beside the card's menu on hover, in the spot where the open copy puts Collapse. The copy names its source link with the item's icon and number instead of an arrow. The card's corners round a little more, concentric with the buttons in them, and the empty state of a column rounds its corners the same way.

**Intake and the rest of the board**

An intake candidate opens the same way, its run buttons in the copy and its description in the tray. Labels stay on one line that scrolls sideways instead of wrapping. A card near the bottom of the window opens its tray above the card instead of climbing to fit, and in the last column the tray slides left by its overflow while the copy stays over the card. The board dims under the open card, and a click on the dim closes it without pressing whatever sat underneath.

**On a phone**

The sheet opens straight onto the same timeline and composer, and hugs its content instead of opening at a fixed height.
