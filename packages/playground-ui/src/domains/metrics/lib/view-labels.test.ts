import { describe, expect, it } from 'vitest';
import { shortViewLabels } from './view-labels';

describe('shortViewLabels', () => {
  it('names each view by what it breaks down by, as a plural', () => {
    expect(shortViewLabels(['Breakdown by project', 'Breakdown by agent', 'Breakdown by entity'])).toEqual([
      'Projects',
      'Agents',
      'Entities',
    ]);
  });

  it('drops the words the views share, keeping the rest as written when it is not a "by" breakdown', () => {
    expect(shortViewLabels(['Agent latency', 'Agent cost'])).toEqual(['Latency', 'Cost']);
  });

  it('keeps labels that share nothing, and a single view, as they are', () => {
    expect(shortViewLabels(['Spend', 'Tokens'])).toEqual(['Spend', 'Tokens']);
    expect(shortViewLabels(['Breakdown by agent'])).toEqual(['Breakdown by agent']);
  });

  it('leaves every label a word of its own', () => {
    expect(shortViewLabels(['Breakdown', 'Breakdown by tool'])).toEqual(['Breakdown', 'Breakdown by tool']);
  });
});
