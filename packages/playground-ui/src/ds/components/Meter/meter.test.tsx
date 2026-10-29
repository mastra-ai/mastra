// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Meter } from './meter';

afterEach(() => {
  cleanup();
});

const segments = (meter: HTMLElement) =>
  Array.from(meter.querySelectorAll<HTMLElement>('[data-slot="meter-bar"] > [data-slot]')).map(segment => ({
    part: segment.dataset.slot,
    grow: segment.style.getPropertyValue('--meter-share'),
  }));

describe('Meter', () => {
  it('names the meter and reports usage against the allowance', () => {
    render(<Meter value={148} max={360} aria-label="Memory" aria-valuetext="148 of 360 GB-hours" />);

    const meter = screen.getByRole('meter', { name: 'Memory' });
    expect(meter.getAttribute('aria-valuenow')).toBe('148');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('360');
    expect(meter.getAttribute('aria-valuetext')).toBe('148 of 360 GB-hours');
  });

  it('fills the used share and leaves the rest of the allowance as track', () => {
    render(<Meter value={148} max={360} aria-label="Memory" />);

    const meter = screen.getByRole('meter');
    expect(meter.hasAttribute('data-over')).toBe(false);
    expect(segments(meter)).toEqual([
      { part: 'meter-used', grow: '148' },
      { part: 'meter-rest', grow: '212' },
    ]);
  });

  it('marks usage beyond the allowance in red, sized to how far over it is', () => {
    render(<Meter value={112} max={100} aria-label="vCPU" />);

    const meter = screen.getByRole('meter');
    expect(meter.hasAttribute('data-over')).toBe(true);
    expect(meter.getAttribute('aria-valuenow')).toBe('100');
    expect(segments(meter)).toEqual([
      { part: 'meter-used', grow: '100' },
      { part: 'meter-over', grow: '12' },
    ]);
  });

  it('reads out how far over the allowance usage is when the caller gives no reading', () => {
    render(<Meter value={112} max={100} aria-label="vCPU" />);

    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('112 of 100, 12 over');
  });

  it('keeps the caller reading over the allowance, units and all', () => {
    render(<Meter value={112} max={100} aria-label="vCPU" aria-valuetext="112 of 100 vCPU-hours, 12 over" />);

    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('112 of 100 vCPU-hours, 12 over');
  });

  it('leaves the reading to aria-valuenow within the allowance', () => {
    render(<Meter value={148} max={360} aria-label="Memory" />);

    expect(screen.getByRole('meter').hasAttribute('aria-valuetext')).toBe(false);
  });

  it('fills the whole bar at exactly the allowance, with nothing in red', () => {
    render(<Meter value={100} max={100} aria-label="vCPU" />);

    expect(segments(screen.getByRole('meter'))).toEqual([{ part: 'meter-used', grow: '100' }]);
  });

  it.each([
    { max: 0, grow: '1' },
    { max: 360, grow: '360' },
  ])('shows an empty track with an allowance of $max when nothing is used', ({ max, grow }) => {
    render(<Meter value={0} max={max} aria-label="Events" />);

    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe(String(max));
    expect(meter.hasAttribute('data-over')).toBe(false);
    expect(segments(meter)).toEqual([{ part: 'meter-rest', grow }]);
  });

  it('reports usage with no allowance as entirely over the allowance', () => {
    render(<Meter value={12} max={0} aria-label="Events" aria-valuetext="12 events, no allowance" />);

    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('0');
    expect(meter.getAttribute('aria-valuetext')).toBe('12 events, no allowance');
    expect(meter.hasAttribute('data-over')).toBe(true);
    expect(segments(meter)).toEqual([{ part: 'meter-over', grow: '12' }]);
  });

  it('can be named by a visible label', () => {
    render(
      <>
        <span id="egress-label">Egress</span>
        <Meter value={3.4} max={10} aria-labelledby="egress-label" />
      </>,
    );

    expect(screen.getByRole('meter', { name: 'Egress' })).not.toBeNull();
  });

  it('stays out of the tab order when it has no sources', () => {
    render(<Meter value={148} max={360} aria-label="Memory" />);

    expect(screen.getByRole('meter').hasAttribute('tabindex')).toBe(false);
  });
});

describe('Meter with sources', () => {
  const renderWithSources = (value: number, max: number) =>
    render(
      <Meter value={value} max={max} aria-label="vCPU">
        <Meter.Source label="research-workflows" value={value - 24} />
        <Meter.Source label="Sandboxes" value={24} />
      </Meter>,
    );

  const sourceShares = (meter: HTMLElement) =>
    Array.from(meter.querySelectorAll<HTMLElement>('[data-slot="meter-sources"] > [data-slot]')).map(segment => ({
      part: segment.dataset.slot,
      grow: segment.style.getPropertyValue('--meter-share'),
    }));

  it('can be focused so keyboard users get the key', () => {
    renderWithSources(148, 360);

    expect(screen.getByRole('meter', { name: 'vCPU' }).tabIndex).toBe(0);
  });

  it('describes the meter with a key of each source and what is left', () => {
    renderWithSources(148, 360);

    const meter = screen.getByRole('meter', { name: 'vCPU' });
    const key = document.getElementById(meter.getAttribute('aria-describedby') ?? '');
    expect(key?.textContent).toContain('research-workflows124');
    expect(key?.textContent).toContain('Sandboxes24');
    expect(key?.textContent).toContain('Remaining212');
  });

  it('splits the bar by source and leaves the rest of the allowance as track', () => {
    renderWithSources(148, 360);

    expect(sourceShares(screen.getByRole('meter'))).toEqual([
      { part: 'meter-source', grow: '124' },
      { part: 'meter-source', grow: '24' },
      { part: 'meter-rest', grow: '212' },
    ]);
  });

  it('keys the overage instead of a remainder when usage is over the allowance', () => {
    renderWithSources(112, 100);

    const meter = screen.getByRole('meter', { name: 'vCPU' });
    const key = document.getElementById(meter.getAttribute('aria-describedby') ?? '');
    expect(key?.textContent).toContain('Over allowance12');
    expect(key?.textContent).not.toContain('Remaining');
    expect(
      meter.querySelector<HTMLElement>('[data-slot="meter-sources"]')?.style.getPropertyValue('--meter-over'),
    ).toMatch(/^10\.71/);
  });
});

describe('Meter paid from credits', () => {
  it('describes over-allowance usage with the amount paid from credits', () => {
    render(<Meter variant="over-allowance" value={112} max={100} paidFromCredits={4.37} aria-label="vCPU" />);

    const meter = screen.getByRole('meter', { name: 'vCPU' });
    const caption = screen.getByText('$4.37 paid from credits');
    expect(meter.getAttribute('aria-describedby')).toBe(caption.id);
    expect(meter.getAttribute('aria-valuetext')).toBe('112 of 100, 12 over');
    expect(segments(meter)).toEqual([
      { part: 'meter-used', grow: '100' },
      { part: 'meter-over', grow: '12' },
    ]);
  });

  it('keeps the caption, caller description and source key accessible together', () => {
    render(
      <>
        <span id="usage-period">This billing period</span>
        <Meter
          variant="over-allowance"
          value={112}
          max={100}
          paidFromCredits={0.004}
          aria-label="vCPU"
          aria-describedby="usage-period"
        >
          <Meter.Source label="Agents" value={112} />
        </Meter>
      </>,
    );

    const meter = screen.getByRole('meter');
    const descriptions = meter
      .getAttribute('aria-describedby')
      ?.split(' ')
      .map(id => document.getElementById(id)?.textContent);
    expect(descriptions).toEqual(['This billing period', '<$0.01 paid from credits', 'Agents112Over allowance12']);
  });

  it.each([
    { value: 80, max: 100, paidFromCredits: 4.37 },
    { value: 100, max: 100, paidFromCredits: 4.37 },
    { value: 112, max: 100, paidFromCredits: undefined },
    { value: 112, max: 100, paidFromCredits: 0 },
    { value: 0, max: 0, paidFromCredits: 0 },
  ])('does not claim a credit payment without charged overage: %j', props => {
    render(<Meter variant="over-allowance" {...props} aria-label="vCPU" />);

    expect(screen.queryByText(/paid from credits/)).toBeNull();
    expect(screen.getByRole('meter').getAttribute('aria-describedby')).toBeNull();
  });

  it('preserves the default meter without a billing caption', () => {
    render(<Meter value={112} max={100} paidFromCredits={4.37} aria-label="vCPU" />);

    expect(screen.queryByText(/paid from credits/)).toBeNull();
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('112 of 100, 12 over');
  });
});

describe('Meter label slot', () => {
  it('preserves the full text of a long label for accessibility and native hover disclosure', () => {
    const label = 'Compute usage for production and preview environments across all projects';
    render(<Meter label={label} value={112} max={100} aria-label={label} />);

    expect(screen.getByTitle(label).textContent).toBe(label);
    expect(screen.getByRole('meter', { name: label })).toBeDefined();
  });

  it('places the visible label and credit caption together before the bar', () => {
    render(
      <Meter
        label={<span>Compute usage</span>}
        variant="over-allowance"
        value={112}
        max={100}
        paidFromCredits={4.37}
        aria-label="Compute usage"
      />,
    );

    const label = screen.getByText('Compute usage');
    const caption = screen.getByText('$4.37 paid from credits');
    const meter = screen.getByRole('meter', { name: 'Compute usage' });
    expect(label.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(caption.compareDocumentPosition(meter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meter.getAttribute('aria-describedby')).toBe(caption.id);
  });

  it('provides a heading slot without requiring a credit charge', () => {
    render(<Meter label="Memory" value={148} max={360} aria-label="Memory" />);

    const label = screen.getByText('Memory');
    const meter = screen.getByRole('meter', { name: 'Memory' });
    expect(label.compareDocumentPosition(meter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/paid from credits/)).toBeNull();
  });

  it('keeps an unlabelled credit caption before its standalone bar', () => {
    render(<Meter variant="over-allowance" value={112} max={100} paidFromCredits={4.37} aria-label="vCPU" />);

    const caption = screen.getByText('$4.37 paid from credits');
    const meter = screen.getByRole('meter', { name: 'vCPU' });
    expect(caption.compareDocumentPosition(meter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
