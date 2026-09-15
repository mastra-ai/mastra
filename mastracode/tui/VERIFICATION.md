# Model Pack System Verification Checklist

Use this checklist to manually validate the pack-system fixes end-to-end.

## 1) Thread-specific pack restore

- [ ] In thread A, run `/models` and select a pack (for example `Anthropic`).
- [ ] In thread B, run `/models` and select a different pack (for example `OpenAI`).
- [ ] Switch back to thread A.
- [ ] Confirm the active pack in `/models` is the one selected for thread A (`Anthropic`).
- [ ] Confirm plan/build/fast mode models match thread A’s pack assignments.

Expected result: each thread restores its own pack selection instead of using one global pack state.

## 2) Model usage ranking

- [ ] Run `/model` and select the same model several times.
- [ ] Reopen `/model`.
- [ ] Confirm frequently selected models appear higher in the list.

Expected result: model ordering reflects persisted `modelUseCounts` and updates over time.

## 3) Model commands

- [ ] Run `/model` and confirm it opens the searchable model selector for the current mode.
- [ ] Change a model while a built-in pack is active and confirm the active pack becomes `Custom`.
- [ ] Run `/models` and confirm it opens the model-pack selector.
- [ ] Run `/packs` and confirm it opens the same model-pack selector.
- [ ] Open `/help` and confirm it describes all three commands.

Expected result: `/model` changes one mode, while `/models` and `/packs` switch packs.

## 4) Custom pack CRUD + targeted edit UX

- [ ] Run `/models` and select `New Custom`.
- [ ] Name it `Pack-A` and choose plan/build/fast models.
- [ ] Run `/models` again, select `New Custom`, create `Pack-B` with different models.
- [ ] Select `Pack-A` and confirm the **Custom pack action picker** visually matches the `Switch model pack` list style (title, list, details).
- [ ] Choose **Edit** and verify menu shows options with inline values, including: `Rename -> <name>`, `plan -> <model>`, `build -> <model>`, `fast -> <model>`, and `Save`.
- [ ] Edit only `fast`, return to the same edit menu, then choose **Save**.
- [ ] Re-open details for `Pack-A` and confirm `plan` + `build` are unchanged.
- [ ] Re-open `Pack-A`, choose **Edit → Rename**, rename to `Pack-A-Renamed`, and confirm old `Pack-A` entry is gone.
- [ ] Select `Pack-B`, choose **Delete**, and confirm it no longer appears.
- [ ] Inspect settings persistence and confirm `customModelPacks` reflects the same final state.

Expected result: custom packs support create, activate, delete, and targeted edit actions without forcing all model selections.
