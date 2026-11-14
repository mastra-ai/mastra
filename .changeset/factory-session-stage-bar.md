---
'mastra': patch
---

Added a stage bar to Factory card sessions. The session header now shows the card's current phase from its own board, with arrows to the nearest phase on either side that the card can move to: a pull request card waiting in **Intake** points straight at **PR review**, past phases it never enters. A menu lists every phase the card can move to, says what each move does, and explains why a phase can't be reached. Time in the current phase shows only while Factory works on the card, not while it waits in a phase such as **Intake** or has finished.

Removed the breadcrumb from session pages so each fact shows once: the sidebar names the session and leads back to the board, the session panel names the card, and the stage bar says where it stands. A card holding sessions in several contexts names the open one, such as **Review session**, with a switcher beside it, and **Go to Work session** in the header actions leads to the session the card has moved on to.

Moved the card's links out of the session header, where pull request links showed twice, into the session panel. The panel opens with the card: its source by number, such as **PR #29371** or a GitLab **Issue #3** without its project path, linked and with its status, then its title and labels, the other pull requests the work touched, separate cards by their reference alone, and a graph of the moves that brought the card to its current phase. Like a sleep tracker's graph, it gives each phase the card has been in a lane and draws each stay as a bar in the phase's colour, so a card sent back from **Review** to **Building** steps back up. Waits in phases such as **Intake** draw hollow and shortened, so days of waiting don't flatten the work. Point at a stay, or focus the graph and use the arrow keys, to read its phase, how long it lasted and when it started.

The session panel now runs from the top of the page, beside the header instead of under it, and the header has no dividing line, so the stage bar sits centered over the conversation. After you open **Changes** or **Files**, the panel's overview shows the branch's added and removed line counts.
