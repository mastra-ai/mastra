---
'@mastra/factory': patch
---

Creating a new Factory no longer takes over the whole screen once you already have one. The flow now runs inline at `/factories/:factoryId/new-factory`, so the sidebar stays in place and you keep the context of the Factory you were in. The full-screen version is still what you get on first run, when no Factory exists yet.

Each step is now a searchable list you type into instead of a form: name the Factory, pick a repository, pick the Linear project that feeds its board (or skip Linear entirely), then choose the provider and model your runs start on. Picking a Linear project routes it to the new Factory and turns its issue sync on, so the board fills up without a detour through Settings. Repository search hits GitHub directly, so large accounts are usable, and keyboard navigation works throughout (arrows to move, Enter to select, Esc to leave).

Nothing is written to the server until the last step: the name, the repository and the Linear choice stay in the draft, and the Factory is created with all of them at once when you pick its model. Quitting the wizard halfway leaves nothing behind. Back walks the steps in reverse and only leaves the wizard from the first one.
