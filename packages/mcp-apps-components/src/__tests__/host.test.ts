import { describe, expect, it } from 'vitest';
import {
  OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY,
  observabilityWidgetPins,
} from '../host';
import type { McpAppRef } from '../host';

const URI = 'ui://mastra/observability-widget';
const widgetApp: McpAppRef = { toolName: 'showObservabilityDashboard', toolCallId: 'call-1', resourceUri: URI };
const otherApp: McpAppRef = { toolName: 'showGreeting', toolCallId: 'call-2', resourceUri: 'ui://mastra/greeting' };

function pinsHost() {
  const heard: unknown[] = [];
  const host = observabilityWidgetPins({
    resourceUri: URI,
    pinnedIds: ['overview'],
    onPin: (pin, app) => heard.push({ pin, app }),
    onUnpin: (id, app) => heard.push({ unpin: id, app }),
  });
  return { host, heard };
}

describe('observabilityWidgetPins', () => {
  it('sends the pinned ids to the widget app only', () => {
    const { host } = pinsHost();

    expect(host.hostContext!(widgetApp)).toEqual({ [OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY]: ['overview'] });
    expect(host.hostContext!(otherApp)).toBeUndefined();
  });

  it('hears pins and unpins from the widget app', () => {
    const { host, heard } = pinsHost();
    const widget = { id: 'agent-runs', kind: 'kpis', views: [] };

    host.onModelContext!(widgetApp, {
      structuredContent: { [OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY]: { pinned: true, widget, datePreset: '7d' } },
    });
    host.onModelContext!(widgetApp, {
      structuredContent: { [OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY]: { pinned: false, widget, datePreset: '7d' } },
    });

    expect(heard).toEqual([
      { pin: { widget, datePreset: '7d' }, app: widgetApp },
      { unpin: 'agent-runs', app: widgetApp },
    ]);
  });

  it('ignores other apps, other context and malformed pins', () => {
    const { host, heard } = pinsHost();
    const pin = { pinned: true, widget: { id: 'agent-runs' }, datePreset: '7d' };

    host.onModelContext!(otherApp, { structuredContent: { [OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY]: pin } });
    host.onModelContext!(widgetApp, { content: [{ type: 'text', text: 'hello' }] });
    for (const bad of [
      { ...pin, pinned: 'yes' },
      { ...pin, widget: { id: 42 } },
      { ...pin, widget: ['agent-runs'] },
      { ...pin, datePreset: undefined },
      'agent-runs',
    ]) {
      host.onModelContext!(widgetApp, { structuredContent: { [OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY]: bad } });
    }

    expect(heard).toEqual([]);
  });
});
