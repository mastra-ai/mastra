const STUDIO_COMPONENT_ID = /^[a-f0-9]{16}$/;

/**
 * Returns the serializable part of a tool's `ui` config. At build time the deployer replaces
 * `ui.studioComponent` with a generated id; anything else (e.g. a component that could not be
 * extracted) is dropped so functions never reach the response.
 */
function serializeToolUI(tool: object): { studioComponent: string } | undefined {
  const ui = 'ui' in tool ? tool.ui : undefined;
  const studioComponent = ui && typeof ui === 'object' && 'studioComponent' in ui ? ui.studioComponent : undefined;
  if (typeof studioComponent !== 'string' || !STUDIO_COMPONENT_ID.test(studioComponent)) {
    return undefined;
  }
  return { studioComponent };
}

/** Replaces `tool.ui` with its serializable form, omitting the key when nothing is serializable. */
export function withSerializedToolUI<T extends object>(tool: T): Omit<T, 'ui'> & { ui?: { studioComponent: string } } {
  const { ui: _ui, ...rest } = tool as T & { ui?: unknown };
  const ui = serializeToolUI(tool);
  return ui ? { ...rest, ui } : rest;
}
