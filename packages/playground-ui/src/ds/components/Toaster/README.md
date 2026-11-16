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

Descriptions use the existing 13px `body-sm` role. Button labels keep their 13px medium-weight role. Actions appear below the message, aligned with its text, with Cancel before the action. Native action objects share Button's link label, typography and hover underline; Sonner controls their callbacks, cancellation, `preventDefault()` and dismissal. For a primary action, pass the actual shared Button through the existing React-node action slot, as above. Custom actions own their callback and dismissal and pass through unchanged.

Use `variant="neutral"` for gray surfaces and neutral text across all notification types. Semantic icons still distinguish success, error, warning and information. Omitting the variant preserves the quiet semantic tints.

```tsx
<Toaster variant="neutral" position="bottom-right" />
```

Loading uses the existing Mastra BrandLoader. When a promise settles, its existing lines and dots merge into a check for success or an × for failure over 200ms in the same fixed icon slot. The color settles with the shape rather than changing abruptly. Promise completion uses a 200ms translated, clipped reveal rather than animating layout height or scaling text. The result description and primary action fade in with the same timing. Reduced motion shows the final card immediately. Caller-provided loading icons opt out of both morphs. A caller-provided success or error icon opts out only for that outcome. Reduced motion disables the pulse and completes the shape change immediately. The wrapper measures unscaled card content and supplies heights and offsets to Sonner's existing stack animations. This keeps card bounds and gaps correct when a toast is updated behind another card, resized or expanded. Removed cards retain their last offset during dismissal. Sonner continues to own ordering, animations, swipe gestures, timers and callbacks. Only genuinely long messages scroll, inside a compact viewport with a pinned heading, subtle divider and thin themed scrollbar. Dismissal and native footer actions stay accessible. Short messages and footer links remain unclipped and non-scrollable.

## Duration

Ordinary toasts use `duration` directly. Promise toasts use `options.duration`: loading stays visible until the operation settles, then the success or error gets that full duration. Hovering pauses the native dismissal timer. `Infinity` keeps a toast open until it is dismissed. The default remains five seconds.

```tsx
toast.success('Copied', { duration: 3000 });

toast.promise({
  myPromise: saveSettings(),
  loadingMessage: 'Saving changes',
  successMessage: 'Changes saved',
  errorMessage: 'Couldn’t save changes',
  options: { duration: 3000 },
});
```

Existing `toast.error(message, options)`, string arrays, React-node actions, promise callbacks, IDs and import paths remain supported.
