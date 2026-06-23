#!/usr/bin/env node
/**
 * Standalone MCP server using @modelcontextprotocol/sdk directly (NOT @mastra/mcp).
 * This simulates a third-party MCP server (like Tim Schmelmer's Trailhead server)
 * that provides ui:// app resources for MCP Apps extension rendering.
 *
 * Run via stdio: npx tsx ./src/mastra/mcp/external-app-server.ts
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'External MCP Apps Server',
  version: '1.0.0',
});

// ── ui:// app resource: a color-mixer UI ────────────────────────────────────
const colorMixerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; padding: 20px; background: #1a1a2e; color: #e0e0e0; opacity: 0; transition: opacity 0.15s; }
    body.ready { opacity: 1; }
    h2 { font-size: 18px; margin-bottom: 8px; color: #e94560; }
    p { color: #aaa; font-size: 13px; margin-bottom: 16px; }
    .row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    label { font-size: 13px; min-width: 70px; }
    input[type="color"] { width: 50px; height: 36px; border: none; cursor: pointer; border-radius: 4px; }
    input[type="text"] { padding: 8px; background: #16213e; border: 1px solid #0f3460; border-radius: 6px; color: #e0e0e0; font-family: monospace; width: 90px; }
    button { padding: 8px 20px; background: #e94560; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
    button:hover { background: #c81e45; }
    .result { margin-top: 12px; padding: 12px; background: #16213e; border-radius: 6px; font-size: 14px; }
    .swatch { width: 60px; height: 60px; border-radius: 8px; border: 2px solid #333; }
  </style>
</head>
<body>
  <h2>Color Mixer</h2>
  <p>This UI is from a <b>non-Mastra</b> MCP server using @modelcontextprotocol/sdk directly.</p>
  <div class="row">
    <label>Color 1:</label>
    <input id="c1" type="color" value="#ff6347" />
    <input id="c1hex" type="text" value="#ff6347" readonly />
  </div>
  <div class="row">
    <label>Color 2:</label>
    <input id="c2" type="color" value="#4169e1" />
    <input id="c2hex" type="text" value="#4169e1" readonly />
  </div>
  <div class="row">
    <button id="btn">Mix Colors</button>
  </div>
  <div id="result" class="result" style="display:none;"></div>
  <script type="module">
    import { App } from 'https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps@1.7.1/+esm';

    var app = new App({ name: 'ColorMixer', version: '1.0.0' });

    document.getElementById('c1').addEventListener('input', function(e) {
      document.getElementById('c1hex').value = e.target.value;
    });
    document.getElementById('c2').addEventListener('input', function(e) {
      document.getElementById('c2hex').value = e.target.value;
    });
    document.getElementById('btn').addEventListener('click', mix);

    async function mix() {
      var btn = document.getElementById('btn');
      btn.disabled = true;
      btn.textContent = 'Mixing\\u2026';
      try {
        var response = await app.callServerTool({
          name: 'mixColors',
          arguments: {
            color1: document.getElementById('c1').value,
            color2: document.getElementById('c2').value,
          }
        });
        var result = response && response.structuredContent
          ? response.structuredContent.result || response.structuredContent
          : (response && response.content && response.content[0]
            ? response.content[0].text
            : response);
        var div = document.getElementById('result');
        div.innerHTML = '<div style="display:flex;align-items:center;gap:12px;">'
          + '<div class="swatch" style="background:' + result + '"></div>'
          + '<span>Mixed: <b>' + result + '</b></span></div>';
        div.style.display = 'block';
      } catch (err) {
        var div = document.getElementById('result');
        div.textContent = 'Error: ' + err.message;
        div.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Mix Colors';
      }
    }

    await app.connect();
    // Reveal after connection (color mixer doesn't receive tool input for hydration)
    setTimeout(function() { document.body.classList.add('ready'); }, 150);
  </script>
</body>
</html>`;

// Register the ui:// resource
server.resource(
  'color-mixer-app',
  'ui://color-mixer/app',
  {
    description: 'Color mixer interactive UI — served from a non-Mastra MCP server',
    mimeType: 'text/html;profile=mcp-app',
  },
  async uri => ({
    contents: [{ uri: uri.href, text: colorMixerHtml }],
  }),
);

// Register the tool with _meta.ui linking to the resource
const mixColorsTool = server.tool(
  'mixColors',
  'Mix two hex colors together. Has an interactive MCP App UI for color picking.',
  {
    color1: z.string().describe('First hex color (e.g. #ff6347)'),
    color2: z.string().describe('Second hex color (e.g. #4169e1)'),
  },
  async ({ color1, color2 }) => {
    // Simple color mixing: average RGB channels
    const parse = (hex: string) => {
      const h = hex.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const [r1, g1, b1] = parse(color1);
    const [r2, g2, b2] = parse(color2);
    const mixed =
      '#' +
      [Math.round((r1 + r2) / 2), Math.round((g1 + g2) / 2), Math.round((b1 + b2) / 2)]
        .map(c => c.toString(16).padStart(2, '0'))
        .join('');
    return { content: [{ type: 'text' as const, text: mixed }] };
  },
);

// Set _meta.ui on the registered tool to link it to the ui:// resource
(mixColorsTool as any)._meta = { ui: { resourceUri: 'ui://color-mixer/app' } };

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
