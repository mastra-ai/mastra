import traceViewerHtml from '../apps-dist/trace-viewer.html?raw';
import type { McpAppResource } from './app-resource';

/**
 * Draws a trace with Studio's timeline. The tool that opens it returns a light trace
 * (`{ traceId, spans, nextOffset? }`, as the built-in server's `get_trace` does); the app pages the
 * rest through `get_trace` and loads a picked span through `get_span`, on the server that opened it.
 */
export const traceViewerApp: McpAppResource = {
  name: 'Trace viewer',
  description: 'Draws a trace timeline and its span details',
  html: traceViewerHtml,
};
