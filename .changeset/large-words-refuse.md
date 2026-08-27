---
'@mastra/playground-ui': patch
---

Search the spans of a trace from the timeline in Studio

A long trace made you scroll to find the one span you cared about. The trace timeline now has a search field, sitting on the left of the span type legend. Type in it and the timeline narrows to the matching spans.

Matching runs over the whole span payload, not a fixed list of fields, so a span is reachable by anything it carries: a tool argument, a model name, an error message, or a value nested deep in its metadata. Field names are searchable too, so you can look for the shape of a payload and not only its content. Matching is case-insensitive, and the work of flattening each span happens once when the trace loads rather than on every keystroke.

A matching span is never shown out of context. Its full parent chain stays visible so you can see where it sits in the trace, and its own subtree stays visible too, so searching for a tool call still shows you what that tool call did. The field keeps working whatever order the spans arrive in, a query that matches nothing leaves the field in place so you can undo it, and clearing the field restores the whole trace.
