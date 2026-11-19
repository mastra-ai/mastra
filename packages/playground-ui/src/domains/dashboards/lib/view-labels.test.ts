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

  it('keeps a word that already reads as a plural', () => {
    expect(shortViewLabels(['Spend by teams', 'Spend by projects', 'Spend by box'])).toEqual([
      'Teams',
      'Projects',
      'Boxes',
    ]);
  });

  it('drops the words the views share, keeping the rest as written when it is not a "by" breakdown', () => {
    expect(shortViewLabels(['Agent latency', 'Agent cost'])).toEqual(['Latency', 'Cost']);
  });

  it('keeps labels that share nothing, and a single view, as they are', () => {
    expect(shortViewLabels(['Spend', 'Tokens'])).toEqual(['Spend', 'Tokens']);
    expect(shortViewLabels(['Breakdown by agent'])).toEqual(['Breakdown by agent']);
  });

  it('keeps the labels when two would shorten to the same name', () => {
    expect(shortViewLabels(['Spend by team', 'Spend by teams'])).toEqual(['Spend by team', 'Spend by teams']);
  });

  it('leaves every label a word of its own', () => {
    expect(shortViewLabels(['Breakdown', 'Breakdown by tool'])).toEqual(['Breakdown', 'Breakdown by tool']);
  });
});
