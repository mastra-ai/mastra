import { describe, expect, it } from 'vitest';
import { extractImportedBindings } from './imported-bindings';

describe('extractImportedBindings', () => {
  describe('static imports', () => {
    it('records default imports as `default`', () => {
      const { importedBindings } = extractImportedBindings(`import a from "a";\nimport { default as b } from "b";`);

      expect(importedBindings).toEqual({ a: ['default'], b: ['default'] });
    });

    it('records the imported name of named imports, not the local alias', () => {
      const { importedBindings } = extractImportedBindings(`import { x, y as z, "kebab-name" as k } from "named";`);

      expect(importedBindings).toEqual({ named: ['x', 'y', 'kebab-name'] });
    });

    it('records namespace imports as `*`', () => {
      const { importedBindings } = extractImportedBindings(`import * as ns from "ns";`);

      expect(importedBindings).toEqual({ ns: ['*'] });
    });

    it('records side-effect imports with no bindings', () => {
      const { importedBindings } = extractImportedBindings(`import "side-effect";\nimport {} from "empty";`);

      expect(importedBindings).toEqual({ 'side-effect': [], empty: [] });
    });

    it('combines default, named and namespace bindings of one source without duplicates', () => {
      const { importedBindings } = extractImportedBindings(
        [`import def, { a } from "pkg";`, `import * as ns from "pkg";`, `import { a as again, b } from "pkg";`].join(
          '\n',
        ),
      );

      expect(importedBindings).toEqual({ pkg: ['default', 'a', '*', 'b'] });
    });
  });

  describe('re-exports', () => {
    it('records `export * from` as `*`', () => {
      const { importedBindings } = extractImportedBindings(`export * from "star";`);

      expect(importedBindings).toEqual({ star: ['*'] });
    });

    it('records `export * as` as `*`', () => {
      const { importedBindings } = extractImportedBindings(`export * as ns from "star-as";`);

      expect(importedBindings).toEqual({ 'star-as': ['*'] });
    });

    it('records the source name of `export { a as b } from`', () => {
      const { importedBindings } = extractImportedBindings(
        `export { a as b, c } from "renamed";\nexport { default, default as d } from "def";`,
      );

      expect(importedBindings).toEqual({ renamed: ['a', 'c'], def: ['default'] });
    });

    it('ignores local exports', () => {
      const { importedBindings } = extractImportedBindings(
        `const local = 1;\nexport { local, local as renamed };\nexport default local;`,
      );

      expect(importedBindings).toEqual({});
    });

    it('merges imports and re-exports of the same source', () => {
      const { importedBindings } = extractImportedBindings(
        `import { a } from "merged";\nexport { b } from "merged";\nexport * from "merged";\nconsole.log(a);`,
      );

      expect(importedBindings).toEqual({ merged: ['a', 'b', '*'] });
    });
  });

  describe('dynamic imports', () => {
    it('collects string literal specifiers only', () => {
      const { importedBindings, dynamicImports } = extractImportedBindings(
        [
          `const name = "computed";`,
          `await import("double");`,
          `await import('single');`,
          'await import(`template`);',
          'await import(`template/${name}`);',
          `await import(name);`,
          `await import("concat" + name);`,
          `await import("with-options", { with: { type: "json" } });`,
          `await import("double");`,
        ].join('\n'),
      );

      expect(dynamicImports).toEqual(['double', 'single', 'template', 'with-options']);
      // Dynamic imports are reported separately so callers can give them `*` bindings.
      expect(importedBindings).toEqual({});
    });
  });

  describe('require calls', () => {
    const code = [
      `var x = __require("x");`,
      `var y = __require("y");`,
      `var plain = require("plain");`,
      `var member = obj.__require("x");`,
      `var extraArgs = __require("x", 1);`,
      `var dynamic = __require(name);`,
    ].join('\n');

    it('ignores require calls when no externals were required', () => {
      expect(extractImportedBindings(code).importedBindings).toEqual({});
    });

    it('records `__require`/`require` calls of required externals as `default`', () => {
      const { importedBindings } = extractImportedBindings(code, new Set(['x', 'plain']));

      expect(importedBindings).toEqual({ x: ['default'], plain: ['default'] });
    });

    it('merges required externals with static imports of the same source', () => {
      const { importedBindings } = extractImportedBindings(
        `import { named } from "x";\nvar x = __require("x");\nconsole.log(named, x);`,
        new Set(['x']),
      );

      expect(importedBindings).toEqual({ x: ['named', 'default'] });
    });

    it('finds require calls nested in functions', () => {
      const { importedBindings } = extractImportedBindings(
        `function load() {\n  return () => __require("nested").value;\n}\nexport { load };`,
        new Set(['nested']),
      );

      expect(importedBindings).toEqual({ nested: ['default'] });
    });

    it('ignores member calls and other identifiers ending in `require`', () => {
      const { importedBindings } = extractImportedBindings(
        [
          `obj.require("member");`,
          `obj?.require("optional");`,
          `obj\n  .__require("chained");`,
          `$require("dollar");`,
          `my_require("underscore");`,
          `myRequire("camel");`,
        ].join('\n'),
        new Set(['member', 'optional', 'chained', 'dollar', 'underscore', 'camel']),
      );

      expect(importedBindings).toEqual({});
    });

    it('accepts every string quote style and whitespace inside the call', () => {
      const { importedBindings } = extractImportedBindings(
        [
          `__require('single');`,
          `__require("double");`,
          'require(`template`);',
          `require (\n  "spaced"\n);`,
          `__require("mismatched'");`,
        ].join('\n'),
        new Set(['single', 'double', 'template', 'spaced', 'mismatched']),
      );

      expect(importedBindings).toEqual({
        single: ['default'],
        double: ['default'],
        template: ['default'],
        spaced: ['default'],
      });
    });

    it('matches ids with regex metacharacters literally', () => {
      const required = new Set(['@scope/pkg.js', 'a+b', 'c|d', 'e(f)']);
      const { importedBindings } = extractImportedBindings(
        [
          `__require("@scope/pkgXjs");`,
          `__require("aab");`,
          `__require("c");`,
          `__require("d");`,
          `__require("ef");`,
          `__require("@scope/pkg.js/sub");`,
        ].join('\n'),
        required,
      );
      expect(importedBindings).toEqual({});

      expect(
        extractImportedBindings([...required].map(id => `__require(${JSON.stringify(id)});`).join('\n'), required)
          .importedBindings,
      ).toEqual({ '@scope/pkg.js': ['default'], 'a+b': ['default'], 'c|d': ['default'], 'e(f)': ['default'] });
    });
  });

  it('throws on code that does not parse', () => {
    expect(() => extractImportedBindings('import {')).toThrow(/Failed to parse analyzed entry/);
  });
});
