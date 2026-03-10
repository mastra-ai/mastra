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

- [ ] Open `/models` and choose a pack that uses a model you can repeatedly select.
- [ ] Re-select the same model multiple times (through pack switches or model picks that call `switchModel`).
- [ ] Re-open the model selector.
- [ ] Confirm frequently selected models appear higher in the sorted list.

Expected result: model ordering reflects persisted `modelUseCounts` and updates over time.

## 3) Command consolidation

- [ ] Run `/models`.
- [ ] Confirm it opens the model-pack selector flow.
- [ ] Run `/models:pack`.
- [ ] Confirm it is not a valid command anymore.
- [ ] Open `/help` and verify only `/models` is shown for model pack switching.

Expected result: `/models` is the single command path for pack selection.

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
