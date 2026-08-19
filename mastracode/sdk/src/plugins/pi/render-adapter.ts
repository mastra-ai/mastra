import type { MastraCodePiToolRenderConfig, MastraCodePiToolRenderOptions } from '../../plugin.js';
import type { PiExtensionGeneration, PiRegisteredTool } from './types.js';

const ANSI_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const RENDER_WIDTH = 80;

type PiComponent = {
  render(width: number): string[];
};

type PiThemeFacade = {
  fg(_color: string, text: string): string;
  bg(_color: string, text: string): string;
  bold(text: string): string;
  italic(text: string): string;
  underline(text: string): string;
  inverse(text: string): string;
  strikethrough(text: string): string;
  getFgAnsi(_color: string): string;
  getBgAnsi(_color: string): string;
  getColorMode(): 'dark';
};

type RendererState = {
  args: unknown;
  state: Record<string, unknown>;
  callComponent?: unknown;
  resultComponent?: unknown;
};

const plainTheme: PiThemeFacade = {
  fg: (_color, text) => text,
  bg: (_color, text) => text,
  bold: text => text,
  italic: text => text,
  underline: text => text,
  inverse: text => text,
  strikethrough: text => text,
  getFgAnsi: () => '',
  getBgAnsi: () => '',
  getColorMode: () => 'dark',
};

function safeFallback(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function renderComponent(component: unknown): string | undefined {
  if (!component || typeof component !== 'object' || !('render' in component)) return undefined;
  const render = (component as Partial<PiComponent>).render;
  if (typeof render !== 'function') return undefined;
  const lines = render.call(component, RENDER_WIDTH);
  if (!Array.isArray(lines) || lines.some(line => typeof line !== 'string')) return undefined;
  return lines
    .map(line => line.replace(ANSI_PATTERN, '').trimEnd())
    .join('\n')
    .trim();
}

export function adaptPiToolRenderers(
  generation: PiExtensionGeneration,
  tool: PiRegisteredTool,
  cwd: string,
): MastraCodePiToolRenderConfig | undefined {
  if (!tool.renderCall && !tool.renderResult) return undefined;
  generation.recordCapability('tool:renderer');
  const states = new Map<string, RendererState>();

  const render = (kind: 'call' | 'result', value: unknown, options: MastraCodePiToolRenderOptions = {}): string => {
    generation.assertActive();
    const renderer = kind === 'call' ? tool.renderCall : tool.renderResult;
    if (!renderer) return safeFallback(value);

    const toolCallId = options.toolCallId ?? 'default';
    const rendererState = states.get(toolCallId) ?? { args: options.args, state: {} };
    if (kind === 'call') rendererState.args = value;
    else if (options.args !== undefined) rendererState.args = options.args;
    const context = {
      args: rendererState.args,
      toolCallId,
      invalidate: () => {},
      lastComponent: kind === 'call' ? rendererState.callComponent : rendererState.resultComponent,
      state: rendererState.state,
      cwd,
      executionStarted: options.executionStarted ?? kind === 'result',
      argsComplete: options.argsComplete ?? true,
      isPartial: options.isPartial ?? false,
      expanded: options.expanded ?? false,
      showImages: options.showImages ?? false,
      isError: options.isError ?? false,
    };

    try {
      const component =
        kind === 'call'
          ? renderer(value, plainTheme, context)
          : renderer(value, { expanded: context.expanded, isPartial: context.isPartial }, plainTheme, context);
      if (kind === 'call') rendererState.callComponent = component;
      else rendererState.resultComponent = component;
      states.set(toolCallId, rendererState);
      const text = renderComponent(component);
      if (text !== undefined) return text;
      generation.addDiagnostic(
        'warning',
        `Pi extension "${generation.extensionId}" tool "${tool.name}" returned an unsupported ${kind} renderer node; Mastra Code used text fallback.`,
        'tool:renderer',
      );
      return safeFallback(value);
    } catch (error) {
      generation.addDiagnostic(
        'warning',
        `Pi extension "${generation.extensionId}" tool "${tool.name}" ${kind} renderer failed; Mastra Code used text fallback: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'tool:renderer',
      );
      return safeFallback(value);
    }
  };

  return {
    type: 'pi-text',
    renderCall: (args, options) => render('call', args, options),
    renderResult: (result, options) => render('result', result, options),
  };
}
