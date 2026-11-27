---
'@mastra/playground-ui': minor
---

Improved the down and up DisclosureChevron: it now bends through a flat line into the other direction instead of rotating 180°. It also follows an open details element without extra props.

```tsx
<details>
  <summary>
    More details <DisclosureChevron />
  </summary>
  …
</details>
```
