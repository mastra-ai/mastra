// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BoardStageIcon, stageColorClass, stageTone } from './board-icons';

afterEach(() => {
  cleanup();
});

const BUILT_IN_PHASES = ['intake', 'triage', 'planning', 'execute', 'review', 'pr-review', 'done', 'canceled'];

function fileUrls(container: HTMLElement): string[] {
  return [...container.querySelectorAll('*')]
    .flatMap(element => [...(element.getAttribute('style') ?? '').matchAll(/url\(\s*["']?([^"')]+)/g)])
    .map(match => match[1])
    .filter(url => !url.startsWith('data:'));
}

describe('BoardStageIcon', () => {
  it.each(BUILT_IN_PHASES)('draws the %s phase without asking the host for a file', stage => {
    const { container } = render(<BoardStageIcon stage={stage} />);

    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(fileUrls(container)).toEqual([]);
  });
});

describe('stageTone', () => {
  it('gives a stage badge the colour of its column, and neutral for a stage it does not know', () => {
    expect(stageTone('triage')).toBe('orange');
    expect(stageColorClass('triage')).toContain('orange');
    expect(stageTone('shipped')).toBe('neutral');
  });
});
