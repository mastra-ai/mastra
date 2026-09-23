// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DataKeysAndValues } from './data-keys-and-values';

afterEach(cleanup);

function renderList(numOfCol: 1 | 2 | 3) {
  const { container } = render(
    <DataKeysAndValues numOfCol={numOfCol}>
      <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>Running</DataKeysAndValues.Value>
    </DataKeysAndValues>,
  );
  return container;
}

describe('DataKeysAndValues columns', () => {
  it('stacks multi-column lists to one column until their container is wide enough', () => {
    const container = renderList(3);
    const list = container.querySelector('dl');

    expect(list?.parentElement?.classList.contains('@container')).toBe(true);
    expect(list?.className).toContain('grid-cols-[auto_1fr]');
    expect(list?.className).toContain('@md:grid-cols-[auto_auto_auto_1fr]');
    expect(list?.className).toContain('@xl:grid-cols-[auto_auto_auto_auto_auto_1fr]');
  });

  it('leaves a single-column list unwrapped so it can size to its content', () => {
    const container = renderList(1);

    expect(container.firstElementChild?.tagName).toBe('DL');
  });
});
