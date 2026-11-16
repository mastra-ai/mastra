import { useState } from 'react';

function measureScrollbarGutters() {
  const probe = document.createElement('div');
  // Mirrors ChatShell's viewport, which keeps a classic scrollbar's room on both edges.
  probe.style.cssText =
    'position:absolute;visibility:hidden;width:100px;overflow-y:auto;scrollbar-gutter:stable both-edges';
  document.body.append(probe);
  const gutters = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return gutters;
}

/** Zero under overlay scrollbars, so only classic ones take room from the transcript. */
export function useScrollbarGutters() {
  const [gutters] = useState(measureScrollbarGutters);
  return gutters;
}
