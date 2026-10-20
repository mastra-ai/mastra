/**
 * Self-contained hosted connect page served by `userConnectRoutes()`.
 *
 * The page only ever talks to the mounted routes on the same origin — it never
 * sees a platform token. OAuth and credential collection happen inside the
 * platform-hosted `connectUrl` popup returned by the session route, so no
 * vendor SDK is bundled here. Flow: explicit Connect click → POST sessions →
 * popup to `connectUrl` → poll status every 2s (5 min cap) → redirect to the
 * validated `returnTo` (or show a success state when none was given).
 */

export interface ConnectPageProvider {
  id: string;
  displayName?: string | null;
  logoUrl?: string | null;
}

export interface ConnectPageParams {
  /** Mount prefix of the connect routes, e.g. `/connect`. */
  basePath: string;
  provider: ConnectPageProvider;
  /** Already validated by the route; null renders the in-page success state. */
  returnTo: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serializes data for embedding inside an inline `<script>`: escapes `<` so a
 * value containing `</script>` cannot break out of the tag, and the JS line
 * separators that are invalid inside string literals.
 */
function toScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Only https URLs are rendered as a logo; anything else is dropped. */
function safeLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  try {
    const parsed = new URL(logoUrl);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function renderConnectPage(params: ConnectPageParams): string {
  const displayName = params.provider.displayName?.trim() || params.provider.id;
  const logoUrl = safeLogoUrl(params.provider.logoUrl);
  const data = toScriptJson({
    basePath: params.basePath,
    providerId: params.provider.id,
    displayName,
    returnTo: params.returnTo,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Connect ${escapeHtml(displayName)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, sans-serif; display: flex; min-height: 100vh; margin: 0; align-items: center; justify-content: center; background: Canvas; color: CanvasText; }
  main { text-align: center; padding: 2rem; max-width: 26rem; }
  img.logo { width: 56px; height: 56px; border-radius: 12px; object-fit: contain; }
  h1 { font-size: 1.25rem; margin: 1rem 0 0.5rem; }
  p { color: GrayText; font-size: 0.9rem; line-height: 1.4; }
  button { font: inherit; padding: 0.6rem 1.6rem; border-radius: 8px; border: 1px solid GrayText; background: ButtonFace; color: ButtonText; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  #status { min-height: 1.5rem; margin-top: 1rem; }
  #status.error { color: #c0392b; }
  a { color: inherit; }
</style>
</head>
<body>
<main>
  ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="" />` : ''}
  <h1>Connect ${escapeHtml(displayName)}</h1>
  <p>You'll be sent to ${escapeHtml(displayName)} to authorize access. This window stays open until the connection is ready.</p>
  <button id="connect" type="button">Connect ${escapeHtml(displayName)}</button>
  <p id="status" role="status"></p>
</main>
<script>
(function () {
  var data = ${data};
  var button = document.getElementById('connect');
  var status = document.getElementById('status');
  var POLL_INTERVAL_MS = 2000;
  var MAX_POLLS = 150; // 5 minutes

  function setStatus(text, isError) {
    status.textContent = text;
    status.className = isError ? 'error' : '';
  }

  function finish(connectionId) {
    if (data.returnTo) {
      var sep = data.returnTo.indexOf('?') === -1 ? '?' : '&';
      window.location.assign(
        data.returnTo + sep + 'connectionId=' + encodeURIComponent(connectionId) + '&status=active',
      );
      return;
    }
    setStatus('Connected. You can close this window.', false);
  }

  function poll(connectionId, popup, attempt) {
    if (attempt >= MAX_POLLS) {
      button.disabled = false;
      setStatus('Timed out waiting for the connection. Try again.', true);
      return;
    }
    fetch(data.basePath + '/connections/' + encodeURIComponent(connectionId) + '/status', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
      .then(function (res) {
        // A pending connection may briefly be invisible; keep polling on 404.
        if (res.status === 404) return { status: 'pending' };
        if (!res.ok) throw new Error('status check failed');
        return res.json();
      })
      .then(function (body) {
        if (body.status === 'active') {
          if (popup && !popup.closed) popup.close();
          finish(connectionId);
          return;
        }
        if (body.status === 'error') {
          button.disabled = false;
          setStatus('The connection failed. Try again.', true);
          return;
        }
        setTimeout(function () {
          poll(connectionId, popup, attempt + 1);
        }, POLL_INTERVAL_MS);
      })
      .catch(function () {
        setTimeout(function () {
          poll(connectionId, popup, attempt + 1);
        }, POLL_INTERVAL_MS);
      });
  }

  button.addEventListener('click', function () {
    button.disabled = true;
    setStatus('Starting…', false);
    // Open the popup synchronously inside the click gesture so popup blockers
    // allow it; it is navigated once the session exists.
    var popup = window.open('about:blank', 'mastra-connect', 'width=600,height=700');
    fetch(data.basePath + '/' + encodeURIComponent(data.providerId) + '/sessions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('session creation failed');
        return res.json();
      })
      .then(function (session) {
        if (popup && !popup.closed) {
          popup.location = session.connectUrl;
          setStatus('Finish authorizing in the popup…', false);
        } else {
          // Popup blocked: offer a manual link instead of auto-navigating away.
          status.textContent = '';
          var link = document.createElement('a');
          link.href = session.connectUrl;
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = 'Popup blocked — click here to authorize';
          status.appendChild(link);
        }
        poll(session.connectionId, popup, 0);
      })
      .catch(function () {
        if (popup && !popup.closed) popup.close();
        button.disabled = false;
        setStatus('Could not start the connection. Try again.', true);
      });
  });
})();
</script>
</body>
</html>`;
}
