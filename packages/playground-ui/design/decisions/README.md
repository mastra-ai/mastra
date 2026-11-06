# Decisions

One note per design decision: why a rule exists, where it applies, and what it replaced. A rule file states the rule and links here; this folder holds the evidence, so the rules stay short and the reasoning stays findable.

## Format

Name each note `NNNN-<slug>.md`, numbered in the order decisions land. Each note has these sections:

- **Decision**: one sentence.
- **Scope**: the products, surfaces, and states it covers, and what it does not cover.
- **Why**: the failure it prevents.
- **Evidence**: quotes with links to the PR or commit that made the decision.
- **Rejected**: the alternatives considered and why each lost.
- **Supersedes**: the earlier note or rule text it replaces, if any.
- **Approved by**: the frontend code owner who approved it, and the date.
- **Reaches**: the command that finds every place the decision applies, so the next change can check each one.

## When a decision earns a note

A rule needs two independent examples, one costly failure, or an explicit decision from a frontend code owner within a stated scope. One reviewer's preference on one PR is an observation, not a rule.

A note changes only by a new note that supersedes it. Edit an old note only to add the link to its successor.
