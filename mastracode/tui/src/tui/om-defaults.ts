import type { TUIState } from './state.js';

/**
 * Pin both live OM roles to the model the user chose during onboarding. OM is
 * otherwise auto, so this only runs for an explicit pack selection.
 */
export async function applyOMModelToSession(state: TUIState, modelId: string): Promise<void> {
  await state.session.om.observer.switchModel({ modelId: modelId });
  await state.session.om.reflector.switchModel({ modelId: modelId });
}
