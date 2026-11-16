---
'@mastra/playground-ui': minor
'mastra': patch
---

Central icons now draw at the size Lucide icons did. The icon sizes grow by 2px (`xs` 14px, `sm` 16px, `md` 18px, `lg` 22px) because Central leaves more room around each drawing, so an icon in the same slot keeps the size people are used to. Product icons, the remaining Lucide icons, brand logos and product marks keep their drawn size. Avatars no longer borrow the icon sizes: the `xs` and `inline` avatars use their own `--spacing-avatar-xs` (12px) and `--spacing-avatar-inline` (16px).

A few Central shapes that run edge to edge, such as plain arrows and the `•••` dots, get an optical inset so they match the rest of the set. The inset lives in `central-icons.json` and the icon generator applies it.
