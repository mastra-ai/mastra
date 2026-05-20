import { describe, expect, it } from 'vitest';
import { IdleCounterComponent, formatIdleDuration } from '../idle-counter.js';

describe('formatIdleDuration', () => {
  it('formats idle time from whole minutes up through larger units', () => {
    expect(formatIdleDuration(1)).toBe('1 minute');
    expect(formatIdleDuration(15)).toBe('15 minutes');
    expect(formatIdleDuration(60)).toBe('1 hour');
    expect(formatIdleDuration(96)).toBe('1 hour 36 minutes');
    expect(formatIdleDuration(24 * 60)).toBe('1 day');
    expect(formatIdleDuration(31 * 24 * 60)).toBe('1 month 1 day');
    expect(formatIdleDuration(365 * 24 * 60)).toBe('1 year');
  });
});

describe('IdleCounterComponent', () => {
  it('reserves one stable line until one minute idle, then renders like a temporal-gap marker', () => {
    const component = new IdleCounterComponent();

    expect(component.render(80)).toEqual(['']);

    component.setIdleStartedAt(0, 59_999);
    expect(component.render(80)).toEqual(['']);

    component.update(60_000);
    expect(component.render(80).join('\n')).toContain('1 minute idle');
    expect(component.render(80).join('\n')).not.toContain('⏳');

    component.update(96 * 60_000);
    expect(component.render(80).join('\n')).toContain('1 hour 36 minutes idle');

    component.setIdleStartedAt(undefined);
    expect(component.render(80)).toEqual(['']);
  });
});
