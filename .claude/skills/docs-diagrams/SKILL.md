---
name: docs-diagrams
description: Convert existing docs diagram images to Mermaid, and author new Mermaid diagrams for Mastra docs. Use when replacing an Excalidraw or PNG/JPG/SVG diagram with Mermaid, when a docs page needs a new diagram, when a diagram renders wrong in light or dark mode, or when auditing which docs images should become Mermaid. Triggers on: convert diagram, Excalidraw, mermaid, flowchart, diagram image, diagram styling, diagram looks wrong.
---

# Docs Diagrams

Read `docs/styleguides/DIAGRAM.md` first. It is the shape, color, and layout
language. This skill is the process for applying it to an image that already
exists.

## Decide whether to convert

Answer in order. Stop at the first yes.

1. Is it a screenshot of a UI? → **Keep the image.** Mermaid draws graphs, not
   product surfaces.
2. Does meaning live in where things sit rather than what connects to what? →
   **Keep the image.** ELK places nodes automatically and will move them. The
   agents overview image, where tool, LLM, and memory sit deliberately beneath
   the agent, loses its point the moment a layout engine touches it.
3. Is it boxes joined by arrows, and would it survive being redrawn by someone
   who only read the node and edge labels? → **Convert.**

A diagram that only converts by fighting the layout engine is a diagram that
should stay an image. Do not add invisible spacer nodes, padding spaces in
labels, or a hand-tuned `elk` block to force a shape. The next writer will not
know why they are there.

## Convert

### 1. Find every reference before touching anything

```bash
grep -rn "<image-filename>" docs/src
```

Docs images are shared across pages more often than expected. The suspend and
resume images appear on both the human-in-the-loop and suspend-and-resume pages.
Converting one page does not free the asset.

### 2. Read the image and name the nodes and edges

Write down each node, its job, and each edge with its label. Work from that
list, not from the picture. The list is what maps onto the shape decision tree
in `DIAGRAM.md`; the picture tempts you into copying a hand-drawn layout that
ELK will not reproduce.

### 3. Write the diagram

Main path first, then branches. Apply shapes from the decision tree, semantic
classes for outcomes only, `accTitle` and `accDescr` always.

Match the story to the sentence above the diagram. A page section about resuming
a workflow gets a diagram that starts at the paused state, not one that replays
the entire run with resume tacked on. When a diagram tries to show a full
suspend and resume loop, ELK pushes the paused node left of the step and crosses
the two dotted edges. Show the leg the section is about.

### 4. Verify in the browser, in both modes

```bash
cd docs && pnpm dev --port 3005
```

Check each of these. They are the failures that actually happen:

- The main path is a straight line. If it bends, a branch was declared too early.
- No node is more than twice the width of its neighbors. If one is, break its
  label with `<br/>`.
- Every edge label sits on its edge, not in open space.
- Toggle light and dark. Text stays readable on both, and no node keeps a fill
  from the other mode.

A screenshot is not verification. Render it.

### 5. Delete the asset only when nothing references it

Re-run the grep from step 1. Zero results, delete the file. Any results, leave
it, and say which pages still use it.

## Extend the color language

Three classes exist: `accent`, `pending`, `danger`. Adding a fourth means one
entry in `docs/src/theme/Mermaid/mastra-mermaid-theme.ts`, with a light and a
dark value, and a row in the `DIAGRAM.md` table. Never add a color by writing
hex in a diagram; it will be wrong in one of the two modes.

## Check the work

- `pnpm lint:remark` in `docs/`
- `pnpm build` in `docs/`, because a Mermaid parse error fails the build rather
  than degrading
