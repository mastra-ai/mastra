---
'@mastra/core': minor
---

Added the `EditorFavorite*` types and an optional `favorites` namespace on `IMastraEditor` so editor implementations can expose favoriting of stored agents and skills.

```ts
import type {
  IMastraEditor,
  IEditorFavoritesNamespace,
  EditorFavoriteTargetInput,
  EditorFavoriteToggleResult,
} from '@mastra/core/editor';

interface IMastraEditor {
  // ...existing members...
  favorites?: IEditorFavoritesNamespace;
}
```

The `favorites` field is optional — existing implementations of `IMastraEditor` continue to work unchanged. `@mastra/editor` ships a default `EditorFavoritesNamespace` that wires this up against the storage `favorites` domain.
