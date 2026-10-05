import { toast } from '@mastra/playground-ui/utils/toast';
import { useConnectChannel } from '@mastra/react/hooks/agents';
import { useCallback } from 'react';

/**
 * Platforms whose connect flow redirects back to the Studio origin when it
 * finishes (the server receives `redirectUrl` and the provider honors it).
 * These navigate the CURRENT tab — a new tab would leave the original Studio
 * tab stale while the callback lands in the copy.
 */
const SAME_TAB_PLATFORMS = new Set(['slack']);

/**
 * Platforms whose connect flow ALWAYS leaves Studio for an external page that
 * cannot redirect back (Discord's bot invite ends on Discord's success page).
 * Only these pre-open a tab in the click handler — a platform that may
 * resolve `immediate` (e.g. Telegram once a credential source exists) would
 * flash a blank tab on every connect.
 */
const ALWAYS_EXTERNAL_PLATFORMS = new Set(['discord']);

/**
 * Navigate to a connect flow's external URL using the pre-opened tab when it
 * is still usable. The pre-opened tab can be `null` (not an always-external
 * platform, or the popup blocker ate it) or already closed by the user — both
 * would silently drop the URL, and the connect POST has already created the
 * pending install, so a dead end strands the flow. Fall back to a fresh tab,
 * then to same-tab navigation, which cannot be blocked.
 */
function openConnectUrl(url: string, tab: Window | null, sameTab: boolean): void {
  if (sameTab) {
    if (tab && !tab.closed) tab.close();
    window.location.href = url;
    return;
  }
  if (tab && !tab.closed) {
    tab.location.href = url;
    return;
  }
  const fresh = window.open(url, '_blank');
  if (fresh) {
    fresh.opener = null;
    return;
  }
  window.location.href = url;
}

/**
 * Wraps {@link useConnectChannel} with the standard UI side-effects shared by every
 * "connect this agent to a channel" surface in the app:
 *
 * - `oauth` / `deep_link` → navigate to the flow's URL. Same-tab for platforms
 *   that redirect back to Studio (Slack); a new tab for flows that end on the
 *   provider's page (Discord, Telegram's BotFather link, Teams' dev portal).
 * - `immediate` → nothing (the installations query is invalidated by the underlying mutation)
 *
 * For always-external platforms the tab is opened synchronously in the click
 * handler — while the click's transient user activation is still live — and
 * navigated once the connect request resolves. Calling `window.open` from the
 * async mutation callback would risk the popup blocker if the request outlives
 * the activation window. It is opened WITHOUT the `noopener` feature (which
 * makes `window.open` return `null` even on success, so a blocked popup would
 * be indistinguishable from an open one); the opener link is severed manually
 * instead. A blocked or prematurely-closed tab falls back to same-tab
 * navigation (see {@link openConnectUrl}) rather than dead-ending the flow.
 *
 * The result is handled through plain promise continuations on `mutateAsync` —
 * NOT React Query's per-call `mutate(vars, { onSuccess })` callbacks, which are
 * skipped when the component unmounts before the request settles (e.g. the user
 * closes the publish dialog). The closure outlives the component, so the
 * pre-opened tab is always navigated or closed and never stranded on
 * `about:blank`.
 *
 * Errors surface as toasts. Pass `onClose` if the calling surface should close itself
 * after a `deep_link` or `immediate` result (used by the publish dialog).
 */
export const useConnectChannelAction = (platform: string, opts: { onClose?: () => void } = {}) => {
  const { mutateAsync, isPending } = useConnectChannel({ platform: platform });
  const { onClose } = opts;

  const connect = useCallback(
    (agentId: string) => {
      const tab = ALWAYS_EXTERNAL_PLATFORMS.has(platform) ? window.open('about:blank', '_blank') : null;
      if (tab) {
        tab.opener = null;
      }

      void mutateAsync({ agentId })
        .then(result => {
          switch (result.type) {
            case 'oauth':
            case 'deep_link': {
              const url = result.type === 'oauth' ? result.authorizationUrl : result.url;
              openConnectUrl(url, tab, SAME_TAB_PLATFORMS.has(platform));
              onClose?.();
              return;
            }
            case 'immediate':
              if (tab && !tab.closed) tab.close();
              onClose?.();
              return;
          }
        })
        .catch((err: Error & { body?: { error?: string } }) => {
          if (tab && !tab.closed) tab.close();
          toast.error(err.body?.error || err.message || 'Failed to connect channel');
        });
    },
    [mutateAsync, onClose, platform],
  );

  return { connect, isConnecting: isPending };
};
