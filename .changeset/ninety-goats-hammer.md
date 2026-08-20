---
'@mastra/factory': minor
---

Redesigned the Factory audit log around a window of time you can scrub.

The log printed one card per event with the metadata folded into a JSON blob behind a disclosure: readable one event at a time, useless for the question people actually bring to an audit trail — what happened to this card yesterday? It is one line per event now, on a fixed grid of when, who, what, on what, and which card, so a run of related events reads as a shape down the page instead of a stack to open one by one. A colored dot carries the namespace, keeping runs, git actions and board moves apart in a mixed stream. Clicking a line opens the ids the columns leave out.

Above the list, the last seven days are drawn as one tick per event, on a lane per namespace. Drag across it to pick a slice, or click a moment to open the couple of hours around it; the list follows. A quiet Sunday and a burst at 3am are visible before you read a single row.

The page reads a whole window rather than a page of the stream, so a filter narrows something complete. Filtering the last cursor page would have shown a fraction of the matches and read as the whole answer. Seven days can outrun what one read can hold — when it does, the page says where the window it actually holds begins instead of implying it covers the rest.
