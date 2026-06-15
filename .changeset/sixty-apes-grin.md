---
'mastracode': patch
---

Unified TUI spacing: removed internal Spacer(1) from all chat components and made every component participate in boundary spacing via getChatSpacingKind(). This eliminates double blank lines (where internal + boundary spacers stacked) and missing blank lines (where components bypassed the spacing system). All chat spacing is now controlled by a single reconciliation pass.
