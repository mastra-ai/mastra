import { describe, it, expect } from 'vitest';
import { detectPinoTransports, detectPinoTransportsPlugin } from './detect-pino-transports';
import { transformSync } from '@babel/core';

describe('detectPinoTransports', () => {
  it('should detect single transport target with double quotes', () => {
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
    const code = `
      import pino from 'pino';
      pino.transport({ target: 'my-transport' })
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('my-transport')).toBe(true);
  });

  it('should detect transport target with template literal', () => {
    const code = `
      import pino from 'pino';
      pino.transport({ target: \`my-transport\` })
    `;

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
      import pino from 'pino';
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

  it('should not match false positives - unrelated objects', () => {
    const code = `
      const config = { target: "not-a-transport" };
      const x = somethingElse.transport({ target: "also-not" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should handle complex nested structure', () => {
    const code = `
      import pino from 'pino';
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

  // Tests for renamed imports
  it('should track renamed pino imports', () => {
    const code = `
      import logger from 'pino';
      const transport = logger.transport({ target: "my-transport" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('my-transport')).toBe(true);
  });

  it('should track namespace pino imports', () => {
    const code = `
      import * as p from 'pino';
      const transport = p.transport({ target: "my-transport" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('my-transport')).toBe(true);
  });

  it('should track require() style imports', () => {
    const code = `
      const pino = require('pino');
      const transport = pino.transport({ target: "my-transport" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('my-transport')).toBe(true);
  });

  it('should track renamed require() style imports', () => {
    const code = `
      const logger = require('pino');
      const transport = logger.transport({ target: "my-transport" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('my-transport')).toBe(true);
  });

  it('should not match transport calls on non-pino imports', () => {
    const code = `
      import somethingElse from 'other-package';
      const transport = somethingElse.transport({ target: "should-not-match" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should handle TypeScript code with types', () => {
    const code = `
      import pino, { Logger } from 'pino';
      type Options = { level: string };
      const transport = pino.transport<Options>({
        target: "pino-pretty",
        options: { level: "info" }
      });
      export const logger: Logger = pino(transport);
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('pino-pretty')).toBe(true);
  });

  it('should handle mixed single and multiple targets', () => {
    const code = `
      import pino from 'pino';
      
      // Single target
      const transport1 = pino.transport({ target: "single-transport" });
      
      // Multiple targets
      const transport2 = pino.transport({
        targets: [
          { target: "multi-a" },
          { target: "multi-b" }
        ]
      });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('single-transport')).toBe(true);
    expect(transports.has('multi-a')).toBe(true);
    expect(transports.has('multi-b')).toBe(true);
    expect(transports.size).toBe(3);
  });

  it('should handle scoped package names', () => {
    const code = `
      import pino from 'pino';
      const transport = pino.transport({
        target: "@scope/my-transport",
      });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('@scope/my-transport')).toBe(true);
  });

  it('should handle transport with relative path target', () => {
    const code = `
      import pino from 'pino';
      const transport = pino.transport({
        target: "./my-local-transport",
      });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('./my-local-transport')).toBe(true);
  });

  it('should return empty set for invalid JavaScript', () => {
    const code = `this is not valid { javascript ( syntax`;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should handle target as string literal key', () => {
    const code = `
      import pino from 'pino';
      pino.transport({ "target": "string-key-transport" })
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('string-key-transport')).toBe(true);
  });

  it('should handle targets as string literal key', () => {
    const code = `
      import pino from 'pino';
      pino.transport({
        "targets": [
          { "target": "string-key-in-array" }
        ]
      })
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('string-key-in-array')).toBe(true);
  });

  // Scope-aware tests (new)

  it('should NOT detect shadowed pino parameter (scope-safe)', () => {
    const code = `
      import pino from 'pino';
      
      function f(pino) {
        // This pino is a parameter, not the import!
        pino.transport({ target: "should-not-match" });
      }
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should NOT detect shadowed pino in inner scope', () => {
    const code = `
      import pino from 'pino';
      
      function outer() {
        const pino = { transport: () => {} }; // shadows import
        pino.transport({ target: "should-not-match" });
      }
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should detect pino in correct scope while ignoring shadowed', () => {
    const code = `
      import pino from 'pino';
      
      // This should match - uses the import
      pino.transport({ target: "should-match" });
      
      function f(pino) {
        // This should NOT match - shadowed
        pino.transport({ target: "should-not-match" });
      }
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('should-match')).toBe(true);
    expect(transports.has('should-not-match')).toBe(false);
    expect(transports.size).toBe(1);
  });

  // pino.default.transport pattern (namespace import interop)

  it('should handle p.default.transport() pattern', () => {
    const code = `
      import * as p from 'pino';
      p.default.transport({ target: "default-interop-transport" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('default-interop-transport')).toBe(true);
  });

  // JSX/TSX support

  it('should handle TSX code with JSX', () => {
    const code = `
      import pino from 'pino';
      import React from 'react';
      
      const transport = pino.transport({ target: "tsx-transport" });
      
      function Component() {
        return <div>Hello</div>;
      }
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('tsx-transport')).toBe(true);
  });

  // import { default as x } pattern tests

  it('should handle import { default as logger } from pino', () => {
    const code = `
      import { default as logger } from 'pino';
      logger.transport({ target: "default-as-transport" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.has('default-as-transport')).toBe(true);
  });

  it('should NOT detect named imports from pino (only default)', () => {
    const code = `
      import { somethingElse as x } from 'pino';
      x.transport({ target: "should-not-match" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should NOT detect pino named export usage', () => {
    const code = `
      import { transport } from 'pino';
      transport({ target: "named-import-not-supported" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  // Edge cases that should NOT match (by design - static extraction only)

  it('should NOT detect destructured transport function', () => {
    // Limitation: destructured patterns are not tracked
    const code = `
      import pino from 'pino';
      const { transport } = pino;
      transport({ target: "destructured-not-supported" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should NOT detect reassigned transport method', () => {
    // Limitation: reassignment not tracked
    const code = `
      import pino from 'pino';
      const transport = pino.transport;
      transport({ target: "reassigned-not-supported" });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should NOT detect dynamic target values', () => {
    const code = `
      import pino from 'pino';
      const getTarget = () => 'dynamic';
      pino.transport({ target: getTarget() });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should NOT detect spread config', () => {
    const code = `
      import pino from 'pino';
      const cfg = { target: 'spread-target' };
      pino.transport({ ...cfg });
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });

  it('should NOT detect variable config', () => {
    const code = `
      import pino from 'pino';
      const cfg = { target: 'var-target' };
      pino.transport(cfg);
    `;

    const transports = detectPinoTransports(code);
    expect(transports.size).toBe(0);
  });
});

describe('detectPinoTransportsPlugin', () => {
  function runPlugin(code: string): Set<string> {
    const transports = new Set<string>();
    transformSync(code, {
      filename: 'testfile.ts',
      presets: [require.resolve('@babel/preset-typescript')],
      plugins: [detectPinoTransportsPlugin(transports)],
      configFile: false,
      babelrc: false,
    });
    return transports;
  }

  it('should work when used as a direct plugin', () => {
    const code = `
      import pino from 'pino';
      pino.transport({ target: "direct-plugin-test" });
    `;

    const transports = runPlugin(code);
    expect(transports.has('direct-plugin-test')).toBe(true);
  });

  it('should correctly track multiple imports in same file', () => {
    const code = `
      import pino from 'pino';
      import logger from 'pino';
      
      pino.transport({ target: "from-pino" });
      logger.transport({ target: "from-logger" });
    `;

    const transports = runPlugin(code);
    expect(transports.has('from-pino')).toBe(true);
    expect(transports.has('from-logger')).toBe(true);
  });
});
