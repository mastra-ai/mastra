import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ConsoleEmailProvider } from '../../email/console';

describe('ConsoleEmailProvider', () => {
  const provider = new ConsoleEmailProvider();
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('send', () => {
    it('should log email to console', async () => {
      await provider.send({
        to: 'test@example.com',
        subject: 'Test Subject',
        template: 'test_template',
        data: { foo: 'bar' },
      });

      expect(consoleSpy).toHaveBeenCalledWith('[Email]', {
        to: 'test@example.com',
        subject: 'Test Subject',
        template: 'test_template',
        data: { foo: 'bar' },
      });
    });

    it('should handle missing optional fields', async () => {
      await provider.send({
        to: 'test@example.com',
        subject: 'Test Subject',
      });

      expect(consoleSpy).toHaveBeenCalledWith('[Email]', {
        to: 'test@example.com',
        subject: 'Test Subject',
        template: undefined,
        data: undefined,
      });
    });
  });

  describe('sendBatch', () => {
    it('should send multiple emails', async () => {
      await provider.sendBatch([
        { to: 'a@example.com', subject: 'Subject A' },
        { to: 'b@example.com', subject: 'Subject B' },
      ]);

      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle empty batch', async () => {
      await provider.sendBatch([]);
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
