# React API

This reference lists every export from `@pierre/theming/react`.

| Export               | Kind | Purpose                                                                   |
| -------------------- | ---- | ------------------------------------------------------------------------- |
| `useThemeController` | Hook | Subscribes to a `ThemeController` and returns its `ThemeControllerState`. |

The hook uses the controller state for both client and server snapshots. Create
the controller outside the component that reads it.
