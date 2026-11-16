import { describe, expect, it } from 'vitest';

import { intakePosition, laneText, ordinal } from '../ruleLanes';

describe('intakePosition', () => {
  const order = [
    { boardKey: 'ship', name: 'Ship' },
    { boardKey: 'work', name: 'Work' },
    { boardKey: 'docs', name: 'Docs' },
  ];

  it('names the boards either side', () => {
    expect(intakePosition(order, 'work')).toBe('Checked after Ship, before Docs');
    expect(intakePosition(order, 'ship')).toBe('Checked first, before Work');
    expect(intakePosition(order, 'docs')).toBe('Checked last, after Work');
    expect(intakePosition(order.slice(0, 1), 'ship')).toBe('The only board intake checks');
  });
});

describe('laneText', () => {
  it('names an event the UI has no words for from its id', () => {
    expect(laneText('pull_request.labeled').label).toBe('Pull request labeled');
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [21, '21st'],
  ])('%i is %s', (n, text) => expect(ordinal(n)).toBe(text));
});
