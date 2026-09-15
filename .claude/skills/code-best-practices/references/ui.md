# UI States

Show the state the system can actually support. Do not hide failures or missing capabilities behind fabricated data, success messages, or working-looking controls. This applies to any UI, regardless of framework.

## Keep Failures Visible

| Situation                          | Expected behavior                                                      |
| ---------------------------------- | ---------------------------------------------------------------------- |
| A request fails                    | Show the error; do not replace it with an empty result or sample data. |
| A request succeeds with no results | Show the empty state.                                                  |
| A mutation is pending              | Keep pending distinct from confirmed success.                          |
| A mutation fails                   | Surface the failure and reconcile any optimistic state.                |
| A capability is unavailable        | Make its unavailability explicit.                                      |

Optimistic updates can show the intended result while a request is pending, but must reconcile with the response and expose failures. Cached data can remain visible during a failed refresh when the UI makes the stale or failed-refresh state clear.

## Simulated Behavior

Use simulated data or behavior when the user explicitly requests a demo, mock, or prototype that needs it. Keep the simulation identifiable within that context; do not carry it into production as a silent fallback.

When real behavior is broken, expose the error and fix its source. Making the frontend look successful must not conceal the failure.
