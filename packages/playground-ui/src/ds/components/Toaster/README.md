# Toast surfaces

`Toaster` keeps Sonner's collapsed stack by default. Hovering over the stack expands it; leaving collapses it again. Use `expand` only when a preview needs every notification visible at once.

```tsx
import { Button } from '@mastra/playground-ui/components/Button';
import { Toaster, toast } from '@mastra/playground-ui/components/Toaster';

<Toaster position="bottom-right" />;

toast.info('Review settings', {
  id: 'review-settings',
  description: 'Choose whether to apply these changes.',
  action: (
    <Button
      type="button"
      variant="primary"
      onClick={() => {
        applySettings();
        toast.dismiss('review-settings');
      }}
    >
      Apply
    </Button>
  ),
  cancel: { label: 'Cancel', onClick: cancelChanges },
});
```

Actions appear below the message. Native action objects share Button's link label, typography and hover underline; Sonner controls their callbacks, cancellation, `preventDefault()` and dismissal. For a primary action, pass the actual shared Button through the existing React-node action slot, as above. Custom actions own their callback and dismissal and pass through unchanged.

Use `variant="neutral"` for gray surfaces and neutral text across all notification types. Semantic icons still distinguish success, error, warning and information. Omitting the variant preserves the quiet semantic tints.

```tsx
<Toaster variant="neutral" position="bottom-right" />
```

Loading uses the existing Mastra BrandLoader. The completed icon replaces it in the same slot without a shape morph or overlapping glyphs. Reduced motion disables the loader pulse. Only genuinely long messages scroll, inside a compact viewport with a pinned heading, subtle divider and thin themed scrollbar. Dismissal and native footer actions stay accessible. Short messages and footer links remain unclipped and non-scrollable.
