# Notice actions

Actions stay below the message by default. Use `Notice.Button` for the shared Button link treatment, including native buttons and links. The underline appears on hover, not at rest.

```tsx
import { Notice } from '@mastra/playground-ui/components/Notice';

<Notice
  variant="destructive"
  title="Couldn't load scorers"
  action={
    <>
      <Notice.Button onClick={retry}>Retry</Notice.Button>
      <Notice.Button render={<a href="/help/scorers" />}>Troubleshoot</Notice.Button>
    </>
  }
>
  The registry request timed out. Check your connection and retry.
</Notice>;
```

Use `actionPlacement="end"` with the existing default Button for a right-side action. The action moves below the message on screens narrower than 640px. Button defaults are unchanged, so specify `type="button"` for actions inside a form that must not submit it.

```tsx
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';

<Notice
  variant="info"
  title="No deploys yet"
  actionPlacement="end"
  action={
    <Button type="button" onClick={openSetup}>
      View setup
    </Button>
  }
>
  Push to a linked branch to create your first deploy.
</Notice>;
```

Titles and messages remain optional. The `success`, `destructive`, `warning`, `info`, and `note` variants keep their semantic icons. Native div props, including refs and caller-selected `role` or live-region attributes, pass through to the root. Notice does not announce itself unless the caller supplies those attributes.

Notice and the shared `lib/toast` implementation use the same quiet surface recipe. Dark rims stay neutral. Colors are scoped to these components; global theme tokens and Button styles do not change.

## Dismissal

Pass `onDismiss` to show the close control. The parent owns visibility, so dismissal can remove only the relevant notice. The control uses the existing tooltip provider, like other icon-only Buttons.

```tsx
const [visible, setVisible] = useState(true);

<TooltipProvider>
  {visible && (
    <Notice variant="info" title="Connection restored" onDismiss={() => setVisible(false)}>
      You can continue working in this workspace.
    </Notice>
  )}
</TooltipProvider>;
```
