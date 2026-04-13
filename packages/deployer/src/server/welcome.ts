export function welcomeHtml(apiPrefix: string = '/api') {
  // Normalize: ensure single leading slash, no trailing slash
  const prefix = '/' + apiPrefix.replace(/^\/+|\/+$/g, '');
  const prefixNoSlash = prefix.slice(1);
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mastra Server</title>
    <style>
      * { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0a;
        color: #e4e4e7;
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        min-height: 100vh;
        line-height: 1.6;
      }

      .page {
        max-width: 720px;
        margin: 0 auto;
        padding: 3rem 1.5rem 4rem;
      }

      header {
        margin-bottom: 2.5rem;
      }

      header h1 {
        font-size: 1.75rem;
        font-weight: 600;
        margin: 0 0 0.25rem;
        color: #fff;
      }

      header p {
        color: #71717a;
        font-size: 0.9rem;
        margin: 0;
      }

      .status-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 1rem;
        font-size: 0.8rem;
        color: #a1a1aa;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #22c55e;
        flex-shrink: 0;
      }

      section {
        margin-bottom: 2rem;
      }

      section h2 {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #71717a;
        margin: 0 0 0.75rem;
      }

      .card {
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 8px;
        overflow: hidden;
      }

      .card + .card {
        margin-top: 0.75rem;
      }

      .card-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        gap: 0.75rem;
      }

      .card-row + .card-row {
        border-top: 1px solid #27272a;
      }

      .card-row-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
      }

      .method {
        font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, monospace;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .method-get { background: #052e16; color: #4ade80; }
      .method-post { background: #172554; color: #60a5fa; }

      .endpoint-path {
        font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, monospace;
        font-size: 0.8rem;
        color: #d4d4d8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .endpoint-desc {
        font-size: 0.75rem;
        color: #71717a;
        flex-shrink: 0;
      }

      .curl-block {
        position: relative;
        background: #111113;
        border: 1px solid #27272a;
        border-radius: 8px;
        overflow: hidden;
      }

      .curl-block + .curl-block {
        margin-top: 0.75rem;
      }

      .curl-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        border-bottom: 1px solid #27272a;
        font-size: 0.75rem;
        color: #a1a1aa;
      }

      .copy-btn {
        background: none;
        border: 1px solid #3f3f46;
        border-radius: 4px;
        color: #a1a1aa;
        font-size: 0.7rem;
        padding: 2px 8px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
      }

      .copy-btn:hover {
        background: #27272a;
        color: #e4e4e7;
      }

      .curl-code {
        padding: 0.75rem 1rem;
        font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, monospace;
        font-size: 0.8rem;
        line-height: 1.5;
        color: #d4d4d8;
        overflow-x: auto;
        white-space: pre;
        margin: 0;
      }

      .curl-code .c-cmd { color: #a78bfa; }
      .curl-code .c-flag { color: #60a5fa; }
      .curl-code .c-url { color: #fbbf24; }
      .curl-code .c-str { color: #4ade80; }

      .links-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }

      .link-card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.875rem 1rem;
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 8px;
        color: #d4d4d8;
        text-decoration: none;
        font-size: 0.85rem;
        transition: all 0.15s;
      }

      .link-card:hover {
        background: #1f1f23;
        border-color: #3f3f46;
        color: #fff;
      }

      .link-icon {
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        color: #71717a;
      }

      .link-card:hover .link-icon { color: #a1a1aa; }

      footer {
        margin-top: 3rem;
        padding-top: 1.5rem;
        border-top: 1px solid #1c1c1f;
        font-size: 0.75rem;
        color: #52525b;
      }

      @media (max-width: 480px) {
        .page { padding: 2rem 1rem 3rem; }
        header h1 { font-size: 1.5rem; }
        .links-grid { grid-template-columns: 1fr; }
        .endpoint-desc { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <h1>Mastra Server</h1>
        <p>Your server is running. Use the endpoints below to get started.</p>
        <div class="status-bar">
          <span class="status-dot"></span>
          <span id="base-url"></span>
        </div>
      </header>

      <section>
        <h2>Quick Start</h2>

        <div class="curl-block">
          <div class="curl-label">
            <span>Check server health</span>
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          </div>
          <pre class="curl-code" data-tpl="curl <base>/health"><span class="c-cmd">curl</span> <span class="c-url" data-url="health"></span></pre>
        </div>

        <div class="curl-block">
          <div class="curl-label">
            <span>List your agents</span>
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          </div>
          <pre class="curl-code" data-tpl="curl <base>${prefix}/agents"><span class="c-cmd">curl</span> <span class="c-url" data-url="${prefixNoSlash}/agents"></span></pre>
        </div>

        <div class="curl-block">
          <div class="curl-label">
            <span>Chat with an agent</span>
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          </div>
          <pre class="curl-code" data-tpl="curl -X POST <base>${prefix}/agents/:agent-id/generate -H 'Content-Type: application/json' -d '{&quot;messages&quot;:[{&quot;role&quot;:&quot;user&quot;,&quot;content&quot;:&quot;Hello&quot;}]}'"><span class="c-cmd">curl</span> <span class="c-flag">-X POST</span> <span class="c-url" data-url="${prefixNoSlash}/agents/:agent-id/generate"></span> \\
  <span class="c-flag">-H</span> <span class="c-str">'Content-Type: application/json'</span> \\
  <span class="c-flag">-d</span> <span class="c-str">'{"messages":[{"role":"user","content":"Hello"}]}'</span></pre>
        </div>

        <div class="curl-block">
          <div class="curl-label">
            <span>Stream an agent response</span>
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          </div>
          <pre class="curl-code" data-tpl="curl -N -X POST <base>${prefix}/agents/:agent-id/stream -H 'Content-Type: application/json' -d '{&quot;messages&quot;:[{&quot;role&quot;:&quot;user&quot;,&quot;content&quot;:&quot;Hello&quot;}]}'"><span class="c-cmd">curl</span> <span class="c-flag">-N -X POST</span> <span class="c-url" data-url="${prefixNoSlash}/agents/:agent-id/stream"></span> \\
  <span class="c-flag">-H</span> <span class="c-str">'Content-Type: application/json'</span> \\
  <span class="c-flag">-d</span> <span class="c-str">'{"messages":[{"role":"user","content":"Hello"}]}'</span></pre>
        </div>
      </section>

      <section>
        <h2>API Endpoints</h2>
        <div class="card">
          <div class="card-row">
            <div class="card-row-left">
              <span class="method method-get">GET</span>
              <span class="endpoint-path">${prefix}/agents</span>
            </div>
            <span class="endpoint-desc">List all agents</span>
          </div>
          <div class="card-row">
            <div class="card-row-left">
              <span class="method method-post">POST</span>
              <span class="endpoint-path">${prefix}/agents/:id/generate</span>
            </div>
            <span class="endpoint-desc">Generate a response</span>
          </div>
          <div class="card-row">
            <div class="card-row-left">
              <span class="method method-post">POST</span>
              <span class="endpoint-path">${prefix}/agents/:id/stream</span>
            </div>
            <span class="endpoint-desc">Stream a response</span>
          </div>
          <div class="card-row">
            <div class="card-row-left">
              <span class="method method-get">GET</span>
              <span class="endpoint-path">${prefix}/workflows</span>
            </div>
            <span class="endpoint-desc">List all workflows</span>
          </div>
          <div class="card-row">
            <div class="card-row-left">
              <span class="method method-post">POST</span>
              <span class="endpoint-path">${prefix}/workflows/:id/start</span>
            </div>
            <span class="endpoint-desc">Run a workflow</span>
          </div>
          <div class="card-row">
            <div class="card-row-left">
              <span class="method method-get">GET</span>
              <span class="endpoint-path">${prefix}/tools</span>
            </div>
            <span class="endpoint-desc">List all tools</span>
          </div>
          <div class="card-row">
            <div class="card-row-left">
              <span class="method method-post">POST</span>
              <span class="endpoint-path">${prefix}/tools/:id/execute</span>
            </div>
            <span class="endpoint-desc">Execute a tool</span>
          </div>
          <div class="card-row">
            <div class="card-row-left">
              <span class="method method-get">GET</span>
              <span class="endpoint-path">${prefix}/memory/threads</span>
            </div>
            <span class="endpoint-desc">List memory threads</span>
          </div>
        </div>
      </section>

      <section>
        <h2>Resources</h2>
        <div class="links-grid">
          <a href="https://mastra.ai/docs" target="_blank" rel="noopener noreferrer" class="link-card">
            <svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            Documentation
          </a>
          <a href="https://mastra.ai/docs/server-db/custom-api-routes" target="_blank" rel="noopener noreferrer" class="link-card">
            <svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>
            Custom API Routes
          </a>
          <a href="https://mastra.ai/docs/agents/overview" target="_blank" rel="noopener noreferrer" class="link-card">
            <svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4m-7.8-15.4 2.8 2.8m9.6 9.6 2.8 2.8M1 12h4m14 0h4M4.2 19.8l2.8-2.8m9.6-9.6 2.8-2.8"/></svg>
            Agents Guide
          </a>
          <a href="https://mastra.ai/docs/workflows/overview" target="_blank" rel="noopener noreferrer" class="link-card">
            <svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
            Workflows Guide
          </a>
        </div>
      </section>

      <footer>
        Powered by <a href="https://mastra.ai" target="_blank" rel="noopener noreferrer" style="color:#71717a;">Mastra</a>
      </footer>
    </div>

    <script>
      (function() {
        var base = location.origin;
        document.getElementById('base-url').textContent = base;

        var els = document.querySelectorAll('[data-url]');
        for (var i = 0; i < els.length; i++) {
          els[i].textContent = base + '/' + els[i].getAttribute('data-url');
        }

        var tpls = document.querySelectorAll('[data-tpl]');
        for (var i = 0; i < tpls.length; i++) {
          tpls[i].setAttribute('data-tpl', tpls[i].getAttribute('data-tpl').replace(/<base>/g, base));
        }
      })();

      function copyCode(btn) {
        var pre = btn.closest('.curl-block').querySelector('.curl-code');
        var text = pre.getAttribute('data-tpl');
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          btn.textContent = 'Unavailable';
          setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
          return;
        }
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
        }).catch(function() {
          btn.textContent = 'Failed';
          setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
        });
      }
    </script>
  </body>
</html>
`;
}
