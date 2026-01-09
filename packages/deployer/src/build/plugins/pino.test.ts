import { describe, it, expect } from 'vitest';
import { detectPinoTransports } from './pino';

describe('detectPinoTransports', () => {
  it('should detect single transport target', () => {
    const code = `
      import pino from 'pino';
      const transport = pino.transport({
        target: "pino-opentelemetry-transport",
        options: { resourceAttributes: { "service.name": "test" } },
      });
      export const logger = pino(transport);
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('pino-opentelemetry-transport')).toBe(true);
    expect(transports.size).toBe(1);
  });

  it('should detect transport target with single quotes', () => {
    const code = `pino.transport({ target: 'my-transport' })`;

    const transports = detectPinoTransports(code);
    expect(transports.has('my-transport')).toBe(true);
  });

  it('should detect transport target with template literal', () => {
    const code = 'pino.transport({ target: `my-transport` })';

    const transports = detectPinoTransports(code);
    expect(transports.has('my-transport')).toBe(true);
  });

  it('should detect multiple transports in targets array', () => {
    const code = `
      import pino from 'pino';
      const transport = pino.transport({
        targets: [
          { target: "pino-pretty", level: "info" },
          { target: "pino-opentelemetry-transport", level: "debug" }
        ]
      });
      export const logger = pino(transport);
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('pino-pretty')).toBe(true);
    expect(transports.has('pino-opentelemetry-transport')).toBe(true);
    expect(transports.size).toBe(2);
  });

  it('should detect transports from multiple pino.transport calls', () => {
    const code = `
      const transport1 = pino.transport({ target: "transport-a" });
      const transport2 = pino.transport({ target: "transport-b" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('transport-a')).toBe(true);
    expect(transports.has('transport-b')).toBe(true);
    expect(transports.size).toBe(2);
  });

  it('should return empty set when no transports found', () => {
    const code = `
      import pino from 'pino';
      export const logger = pino();
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should not match false positives', () => {
    const code = `
      const config = { target: "not-a-transport" };
      const x = somethingElse.transport({ target: "also-not" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should handle complex nested structure', () => {
    const code = `
      pino.transport({
        targets: [
          { 
            target: "first-transport",
            options: { 
              nested: { 
                value: true 
              } 
            } 
          },
          { target: "second-transport" }
        ]
      })
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('first-transport')).toBe(true);
    expect(transports.has('second-transport')).toBe(true);
  });
});
