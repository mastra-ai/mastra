let searchTrigger: HTMLElement | undefined;

function currentTrigger(): HTMLElement | undefined {
  const trigger = searchTrigger;
  if (!trigger) return undefined;
  if (trigger.isConnected) return trigger;
  if (!trigger.id) return undefined;
  return document.getElementById(trigger.id) ?? undefined;
}

export function rememberGlobalSearchTrigger(trigger?: HTMLElement) {
  if (trigger) {
    searchTrigger = trigger;
    return;
  }
  if (document.activeElement instanceof HTMLElement) searchTrigger = document.activeElement;
}

export function restoreGlobalSearchTriggerFocus() {
  const trigger = currentTrigger();
  searchTrigger = undefined;
  trigger?.focus({ preventScroll: true });
}
