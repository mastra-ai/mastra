import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { spanIcon } from '../span-icon';

afterEach(() => cleanup());

/** Renders the icon and reports whether an <svg> came out, so we don't assert on paths. */
function hasSvg(node: ReturnType<typeof spanIcon>): boolean {
  if (!node) return false;
  const { container } = render(<>{node}</>);
  return container.querySelector('svg') !== null;
}

describe('spanIcon', () => {
  it.each([
    ['agent_run'],
    ['tool_call'],
    ['client_tool_call'],
    ['provider_tool_call'],
    ['mcp_tool_call'],
    ['processor_run'],
    ['workflow_run'],
    ['workflow_step'],
    ['workspace_action'],
  ])('uses the sidebar icon for %s', spanType => {
    expect(hasSvg(spanIcon({ spanId: 'a', spanType } as never))).toBe(true);
  });

  it('falls back to the plain dot for kinds with no sidebar entity', () => {
    // No sidebar entry exists for model generation, so nothing to borrow an icon from.
    expect(spanIcon({ spanId: 'a', spanType: 'model_generation' } as never)).toBeUndefined();
    expect(spanIcon({ spanId: 'a', spanType: 'model_chunk' } as never)).toBeUndefined();
  });
});
