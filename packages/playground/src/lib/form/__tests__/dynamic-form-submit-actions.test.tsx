import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { DynamicForm } from '../dynamic-form';

afterEach(() => cleanup());

const Disclosure = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open panel
      </button>
      {open && <span>Panel is open</span>}
    </>
  );
};

const Host = () => {
  const [label, setLabel] = useState('Run');
  return (
    <>
      <button type="button" onClick={() => setLabel('Re-run')}>
        Rename submit
      </button>
      <DynamicForm
        schema={z.object({ value: z.string() })}
        onSubmit={() => {}}
        submitButtonLabel={label}
        submitActions={<Disclosure />}
      />
    </>
  );
};

describe('DynamicForm submit actions', () => {
  describe('when the parent re-renders while a submit action holds state', () => {
    it('keeps that state instead of remounting the action', async () => {
      render(<Host />);

      fireEvent.click(await screen.findByRole('button', { name: 'Open panel' }));
      expect(screen.getByText('Panel is open')).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Rename submit' }));

      expect(screen.getByRole('button', { name: 'Re-run' })).not.toBeNull();
      expect(screen.getByText('Panel is open')).not.toBeNull();
    });
  });
});
