---
'@mastra/playground-ui': minor
---

Added shared composer layout pieces so Studio and Factory render the same chat composer.

- `ModelPicker` (`@mastra/playground-ui/domains/llm`): one trigger for provider and model, with a provider filter row, search across all providers, and a bottom sheet on small screens. Pass `renderProviderIcon` to use your own provider icons and `openOnSelectedProvider` to open on the selected provider for large catalogs.
- `ComposerStatus`: a right-aligned status row above the composer that hides itself when empty.
- `ComposerActionsStart` and `ComposerActionsEnd`: leading and trailing groups for the composer actions row.
- `ComposerHeader` `placement="overlay"`: floats the header above the composer so opening it never moves the transcript.
- `PopoverContent` `positionerClassName`: style the positioner, for example to pin the popup as a bottom sheet.
