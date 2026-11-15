---
'mastra': patch
---

Added a stage bar to Factory card sessions. The session header now shows the card's current phase from its own board, with arrows to the nearest phase on either side that the card can move to: a pull request card waiting in **Intake** points straight at **PR review**, past phases it never enters. A menu lists every phase the card can move to and says what each move does; an arrow to a phase that needs a pull request says so. While the card's session works, moves that would start another run are held back, as on the board, and a held or blocked arrow names its reason to screen readers as well as in its tooltip. Time in the current phase shows only in phases where Factory works on the card, not while it waits in a phase such as **Intake** or has finished.

Removed the breadcrumb from session pages so each fact shows once: the sidebar names the session and leads back to the board, the session panel names the card, and the stage bar says where it stands. A card holding sessions in several contexts names the open one, such as **Review session**, with a switcher beside it, and a **Work →** link next to the switcher leads to the session the card has moved on to.

The session panel now runs from the top of the page, beside the header instead of under it. The header no longer takes a strip of its own: the title, the stage bar and the header actions float over the conversation in raised capsules, and the conversation scrolls beneath them. On wide screens the header actions' capsule is the closed panel: opening it unfolds the capsule into the panel from its right edge, around the actions, which stay where they are, and closing folds it back. While the panel is open, the conversation keeps its full width: when the room shrinks, after resizing the window or opening the sidebar, the panel narrows instead, following the resize as it happens. Once the panel can't narrow any further, it folds into the capsule, and once it fits again, such as after closing the sidebar, it unfolds, instead of vanishing or appearing at once.

Search now sits only in the sidebar, on phones too: the header no longer adds a search button while the sidebar is hidden. Cmd/Ctrl+K still opens it from any page.

Opening, closing and resizing the panel, dragging the sidebar's edge, and new messages arriving no longer restyle or re-render the whole conversation, so long sessions stay smooth.

**Panel navigation**

The panel's top row names what the session works on, on one line: the card's title, or the session's own title for a session without a card. A title too long for the row is cut short and shows in full on hover. Opening **Changes** from the overview puts a back arrow at the start of the row, with a **Changes** and **Files** switch under it that moves between the diff and the session's files without leaving the view; from an open file, the back arrow returns to the files. Keyboard focus follows: it lands on the back arrow, and going back returns it to the row that opened the view.

**Overview**

The overview reads top to bottom like the card:

- The card's source as one link, such as a GitLab **Issue #3** without the project path the workspace already names, with its state beside it, then its labels.
- The source's description as a short preview that expands in place with **Show more**. A description added in Factory follows it under **Added in Factory**.
- The workspace: its branch, then the repository and the branch it merges into, each with its icon. On a pull request card, the pull request sits here too, as **PR #29371** led by its status icon: green while open, gray as a draft, purple once merged. Then **Changes**, with the number of changed files and the added and removed line counts, which opens the diff and the files in the panel; on a branch with no changes, it opens the files. The row shows a count only once it has read one: while reading, it says so, and when the changes can't be read it says **Unavailable** instead of showing none.
- The pull requests the work opened, the related cards with the phase each sits in, and a graph of the card's moves.

The moves graph is a timeline, like a sleep tracker's: each phase the card has been in gets a lane, and each stay is a bar in the phase's colour as long as the stay itself, so a card sent back from **Review** to **Building** steps back up and a long wait shows as long. Point at a stay, or focus the graph and use the arrow keys, to read its phase, how long it lasted and when it started, including the current stay so far.

**Files**

- The file tree marks each changed file with its change letter and puts a dot on folders that hold changes.
- **Go to file** searches every file in the workspace, ranks changed files first, and opens a result where the tree keeps it, showing hidden files when the path needs them. When it lists only some matches, or the workspace is only partly indexed, it says so.
- The file viewer numbers its lines, and a file too large to show in full says it shows the start.

**One answer per fact**

- The sidebar's hover card and the panel's moves graph now read the card's stays the same way, so they agree on which phase the card was in and for how long.
- Phase names follow the card's own board everywhere, including custom boards.
- The sidebar row's time says what it measures: the card's last stage move, or when the session started.
- A pull request's status icon follows one rule on the board, in the sidebar and in the panel: once the card or the session's subscription knows the pull request merged, it shows as merged, and a known close isn't undone by a subscription that reopens; otherwise whichever of the two heard from the code host last wins. While neither knows the state, the plain pull request or merge request icon shows instead of **Open**. Board cards go by the card alone.
- A pull request's state shows as its status icon only, so board cards no longer repeat it in a badge. GitLab merge request cards now show the status icon too.
- Links name what they point at, such as **PR #202** or **Issue #42**, and add the repository only where more than one could be meant.
- A finished pull request card whose pull request is still open, or whose state isn't known yet, offers **Re-review**.
- A card's description reads the same in the board's card details and in the panel, with the description's own headings set under the card's title.
- A section that can't be read says so, such as **Couldn't load the card.** or **Couldn't load pull requests.**, instead of looking empty. When the board can't be read, related cards name no phase rather than guess one.
