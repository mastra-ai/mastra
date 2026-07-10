import { ChevronsUpDown } from 'lucide-react';

import { useOverlays } from '../../../../lib/overlays';
import { useChatModels } from '../../context/useChatModels';

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] || id;
}

/** Current model id, or the no-model fallback before the session syncs. */
export function ActiveModel() {
  const { activeModelId } = useChatModels();
  const overlays = useOverlays();
  const label = activeModelId ? lastSegment(activeModelId) : 'no model';

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-icon3 tabular-nums hover:bg-surface4 hover:text-icon5 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-border1"
      onClick={() => overlays.open('model-settings')}
      aria-label={activeModelId ? `Change model from ${label}` : 'Select a model'}
      title="Choose a model"
    >
      <span>{label}</span>
      <ChevronsUpDown size={12} aria-hidden />
    </button>
  );
}
