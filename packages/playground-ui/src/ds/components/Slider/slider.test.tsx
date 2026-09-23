// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Slider } from './slider';

afterEach(cleanup);

describe('Slider', () => {
  describe('when a range slider names its thumbs through getAriaLabel', () => {
    it('gives each thumb its own accessible name', () => {
      render(<Slider defaultValue={[20, 80]} getAriaLabel={index => (index === 0 ? 'Minimum' : 'Maximum')} />);

      expect(screen.getByLabelText('Minimum')).toHaveProperty('type', 'range');
      expect(screen.getByLabelText('Maximum')).toHaveProperty('type', 'range');
    });
  });
});
