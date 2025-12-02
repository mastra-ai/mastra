import { GenericId } from "../values/index.js";
import { describe, test, expect } from "vitest";
import { assert, Equals } from "../test/type_testing.js";
import { v, Infer } from "../values/validator.js";

describe("Validators", () => {
  test("optional types don't lose specificity", () => {
    const a = v.optional(v.id("a"));
    const b = v.optional(v.null());
    const c = v.optional(v.number());
    const d = v.optional(v.int64());
    const e = v.optional(v.boolean());
    const f = v.optional(v.string());
    const g = v.optional(v.bytes());
    const h = v.optional(v.literal("a"));
    const i = v.optional(v.array(v.string()));
    const j = v.optional(v.object({ a: v.string() }));
    const k = v.optional(v.record(v.string(), v.string()));
    const l = v.optional(v.union(v.string(), v.number()));

    // Optional makes types a union with undefined.
    assert<Equals<Infer<typeof a>, GenericId<"a"> | undefined>>();
    assert<Equals<Infer<typeof b>, null | undefined>>();
    assert<Equals<Infer<typeof c>, number | undefined>>();
    assert<Equals<Infer<typeof d>, bigint | undefined>>();
    assert<Equals<Infer<typeof e>, boolean | undefined>>();
    assert<Equals<Infer<typeof f>, string | undefined>>();
    assert<Equals<Infer<typeof g>, ArrayBuffer | undefined>>();
    assert<Equals<Infer<typeof h>, "a" | undefined>>();
    assert<Equals<Infer<typeof i>, string[] | undefined>>();
    assert<Equals<Infer<typeof j>, { a: string } | undefined>>();
    assert<Equals<Infer<typeof k>, Record<string, string> | undefined>>();
    assert<Equals<Infer<typeof l>, string | number | undefined>>();

    // Note: this test does not actually verify this property unless
    // the tsconfig.json option `"exactOptionalPropertyTypes": true` is used.
    const _optionals = v.object({ a, b, c, d, e, f, g, h, i, j, k, l });
    assert<
      Equals<
        Infer<typeof _optionals>,
        {
          a?: GenericId<"a">;
          b?: null;
          c?: number;
          d?: bigint;
          e?: boolean;
          f?: string;
          g?: ArrayBuffer;
          h?: "a";
          i?: string[];
          j?: { a: string };
          k?: Record<string, string>;
          l?: string | number;
        }
      >
    >();
  });

  test("Most validators don't accept optional validators as children", () => {
    const optional = v.optional(v.string());
    const required = v.string();

    v.object({ optional });

    v.array(required);
    // @ts-expect-error This should be an error
    v.array(optional);

    v.record(required, required);

    const invalidRecordError = "Record validator cannot have optional ";
    // @ts-expect-error This should be an error
    expect(() => v.record(required, optional)).toThrowError(
      invalidRecordError + "values",
    );
    // @ts-expect-error This should be an error
    expect(() => v.record(optional, required)).toThrowError(
      invalidRecordError + "keys",
    );
    // @ts-expect-error This should be an error
    expect(() => v.record(optional, optional)).toThrowError(
      invalidRecordError + "keys",
    );

    v.union(required, required);
    // @ts-expect-error This should be an error
    v.union(optional, optional);
    // @ts-expect-error This should be an error
    v.union(required, optional);
    // @ts-expect-error This should be an error
    v.union(optional, required);
  });

  test("Record validators cannot have non-strings as arguments", () => {
    v.record(v.id("table1"), v.string());
    v.record(v.union(v.id("table1"), v.id("table2")), v.string());

    // @ts-expect-error This should be an error
    v.record(v.number(), v.string());
    // @ts-expect-error This should be an error
    v.record(v.int64(), v.string());
    // @ts-expect-error This should be an error
    v.record(v.float64(), v.string());
    // @ts-expect-error This should be an error
    v.record(v.null(), v.string());
    // @ts-expect-error This should be an error
    v.record(v.boolean(), v.string());

    // These patterns will compile, but will be rejected by the server
    v.record(v.union(v.literal("abc"), v.literal("def")), v.string());
    v.record(v.union(v.id("table1"), v.literal("def")), v.string());
  });

  test("complex types look good", () => {
    const _obj = v.object({
      a: v.record(v.string(), v.string()),
      b: v.string(),
      c: v.union(v.string(), v.union(v.string(), v.number())),
      d: v.object({ foo: v.string(), bar: v.optional(v.number()) }),
    });

    type Expected = {
      a: Record<string, string>;
      b: string;
      c: string | number;
      d: {
        bar?: number | undefined;
        foo: string;
      };
    };
    assert<Equals<Infer<typeof _obj>, Expected>>();
  });
});

describe("invalid validators fail when constructed obviously wrongly", () => {
  describe("easy ones", () => {
    test("v.id", () => {
      expect(() => {
        (v as any).id();
      }).toThrow();

      expect(() => {
        v.id({} as any);
      }).toThrow();

      expect(() => {
        v.id({} as any);
      }).toThrow();
    });

    // no tests for v.null, number, floag64, bigint, in64, boolean, string, or bytes

    test("v.literal", () => {
      expect(() => {
        (v as any).literal();
      }).toThrow();

      expect(() => {
        v.literal({} as any);
      }).toThrow();
    });
  });

  test("v.object", () => {
    expect(() => {
      (v as any).object();
    }).toThrow();

    expect(() => {
      v.object({ a: {} } as any);
    }).toThrow();

    expect(() => {
      v.object({});
    }).not.toThrow();

    expect(() => {
      v.object({ a: undefined as any });
    }).toThrow();
  });

  test("v.object regression test", () => {
    expect(() => {
      // real issue from the wild
      v.object({ a: v.string as any });
    }).toThrow();
  });

  test("v.record", () => {
    expect(() => {
      (v as any).record();
    }).toThrow();

    expect(() => {
      v.record({} as any, {} as any);
    }).toThrow();
  });

  test("v.union", () => {
    expect(() => {
      v.union({} as any, {} as any);
    }).toThrow();
  });
});

describe("v.object utility methods", () => {
  describe("omit", () => {
    test("omits specified fields from VObject", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
        c: v.boolean(),
      });

      const omitted = original.omit("b");

      // Type checks
      assert<
        Equals<
          Infer<typeof omitted>,
          {
            a: string;
            c: boolean;
          }
        >
      >();

      // Runtime checks
      expect(omitted.fields).toHaveProperty("a");
      expect(omitted.fields).toHaveProperty("c");
      expect(omitted.fields).not.toHaveProperty("b");
      expect(omitted.isOptional).toBe("required");
    });

    test("omits multiple fields", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
        c: v.boolean(),
        d: v.int64(),
      });

      const omitted = original.omit("b", "d");

      // Type checks
      assert<
        Equals<
          Infer<typeof omitted>,
          {
            a: string;
            c: boolean;
          }
        >
      >();

      // Runtime checks
      expect(omitted.fields).toHaveProperty("a");
      expect(omitted.fields).toHaveProperty("c");
      expect(omitted.fields).not.toHaveProperty("b");
      expect(omitted.fields).not.toHaveProperty("d");
    });

    test("preserves optional status", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
      });
      const optional = original.asOptional();
      const omitted = optional.omit("b");

      // Runtime check: isOptional is preserved
      expect(omitted.isOptional).toBe("optional");
      expect(omitted.fields).toHaveProperty("a");
      expect(omitted.fields).not.toHaveProperty("b");
    });
  });

  describe("pick", () => {
    test("picks specified fields from VObject", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
        c: v.boolean(),
      });

      const picked = original.pick("a", "c");

      // Type checks
      assert<
        Equals<
          Infer<typeof picked>,
          {
            a: string;
            c: boolean;
          }
        >
      >();

      // Runtime checks
      expect(picked.fields).toHaveProperty("a");
      expect(picked.fields).toHaveProperty("c");
      expect(picked.fields).not.toHaveProperty("b");
      expect(picked.isOptional).toBe("required");
    });

    test("picks single field", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
        c: v.boolean(),
      });

      const picked = original.pick("b");

      // Type checks
      assert<
        Equals<
          Infer<typeof picked>,
          {
            b: number;
          }
        >
      >();

      // Runtime checks
      expect(picked.fields).toHaveProperty("b");
      expect(picked.fields).not.toHaveProperty("a");
      expect(picked.fields).not.toHaveProperty("c");
    });

    test("preserves optional status", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
      });
      const optional = original.asOptional();
      const picked = optional.pick("a");

      // Runtime check: isOptional is preserved
      expect(picked.isOptional).toBe("optional");
      expect(picked.fields).toHaveProperty("a");
      expect(picked.fields).not.toHaveProperty("b");
    });
  });

  describe("partial", () => {
    test("makes all fields optional", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
        c: v.boolean(),
      });

      const partial = original.partial();

      // Type checks
      assert<
        Equals<
          Infer<typeof partial>,
          {
            a?: string;
            b?: number;
            c?: boolean;
          }
        >
      >();

      // Runtime checks
      expect(partial.fields.a.isOptional).toBe("optional");
      expect(partial.fields.b.isOptional).toBe("optional");
      expect(partial.fields.c.isOptional).toBe("optional");
      expect(partial.isOptional).toBe("required");
    });

    test("works with already optional fields", () => {
      const original = v.object({
        a: v.string(),
        b: v.optional(v.number()),
        c: v.boolean(),
      });

      const partial = original.partial();

      // Type checks - all fields should be optional
      type Result = Infer<typeof partial>;
      const _test1: Result = { a: "hello", b: 42, c: true };
      const _test2: Result = { a: "hello" };
      const _test3: Result = {};

      // Runtime checks
      expect(partial.fields.a.isOptional).toBe("optional");
      expect(partial.fields.b.isOptional).toBe("optional");
      expect(partial.fields.c.isOptional).toBe("optional");
    });

    test("preserves optional status on VObject itself", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
      });
      const optional = original.asOptional();
      const partial = optional.partial();

      // Runtime check: isOptional is preserved
      expect(partial.isOptional).toBe("optional");
      expect(partial.fields.a.isOptional).toBe("optional");
      expect(partial.fields.b.isOptional).toBe("optional");
    });
  });

  describe("extend", () => {
    test("extends VObject with new fields", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
      });

      const extended = original.extend({
        c: v.boolean(),
        d: v.int64(),
      });

      // Type checks
      type Result = Infer<typeof extended>;
      const _test: Result = { a: "hello", b: 42, c: true, d: 100n };

      // Runtime checks
      expect(extended.fields).toHaveProperty("a");
      expect(extended.fields).toHaveProperty("b");
      expect(extended.fields).toHaveProperty("c");
      expect(extended.fields).toHaveProperty("d");
      expect(extended.isOptional).toBe("required");
    });

    test("extends with additional fields without conflicts", () => {
      const original = v.object({
        a: v.string(),
        b: v.number(),
      });

      const extended = original.extend({
        c: v.int64(),
        d: v.boolean(),
      });

      // Type checks
      type Result = Infer<typeof extended>;
      const _test: Result = { a: "hello", b: 42, c: 100n, d: true };

      // Runtime checks
      expect(extended.fields.c.kind).toBe("int64");
      expect(extended.fields.d.kind).toBe("boolean");
    });

    test("preserves optional status", () => {
      const original = v.object({
        a: v.string(),
      });
      const optional = original.asOptional();
      const extended = optional.extend({
        b: v.number(),
      });

      // Runtime check: isOptional is preserved
      expect(extended.isOptional).toBe("optional");
      expect(extended.fields).toHaveProperty("a");
      expect(extended.fields).toHaveProperty("b");
    });
  });

  describe("chaining utility methods", () => {
    test("can chain multiple operations", () => {
      const base = v.object({
        a: v.string(),
        b: v.number(),
        c: v.boolean(),
        d: v.int64(),
      });

      const result = base.omit("d").extend({ e: v.bytes() }).partial();

      // Type checks
      type Result = Infer<typeof result>;
      const _test1: Result = {
        a: "hello",
        b: 42,
        c: true,
        e: new ArrayBuffer(0),
      };
      const _test2: Result = { a: "hello" };
      const _test3: Result = {};

      // Runtime checks
      expect(result.fields).toHaveProperty("a");
      expect(result.fields).toHaveProperty("b");
      expect(result.fields).toHaveProperty("c");
      expect(result.fields).toHaveProperty("e");
      expect(result.fields).not.toHaveProperty("d");
      expect(result.fields.a.isOptional).toBe("optional");
    });

    test("complex chaining scenario", () => {
      const user = v.object({
        name: v.string(),
        email: v.string(),
        age: v.number(),
        password: v.string(),
      });

      // Create a public user type: omit password, add system fields, then make partial for updates
      const publicUser = user.omit("password").extend({
        _id: v.id("users"),
        _creationTime: v.number(),
      });
      const userUpdate = publicUser.partial().omit("_id", "_creationTime");

      // Type checks
      type PublicUser = Infer<typeof publicUser>;
      const _testPublic: PublicUser = {
        name: "Alice",
        email: "alice@example.com",
        age: 30,
        _id: "123" as GenericId<"users">,
        _creationTime: 1234567890,
      };

      type UserUpdate = Infer<typeof userUpdate>;
      const _testUpdate1: UserUpdate = {
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      };
      const _testUpdate2: UserUpdate = { name: "Bob" };
      const _testUpdate3: UserUpdate = {};

      // Runtime checks
      expect(publicUser.fields).toHaveProperty("name");
      expect(publicUser.fields).toHaveProperty("_id");
      expect(publicUser.fields).not.toHaveProperty("password");

      expect(userUpdate.fields).toHaveProperty("name");
      expect(userUpdate.fields.name.isOptional).toBe("optional");
      expect(userUpdate.fields).not.toHaveProperty("_id");
      expect(userUpdate.fields).not.toHaveProperty("password");
    });
  });

  describe("fieldPaths inference", () => {
    test("fieldPaths are correctly inferred after omit", () => {
      const original = v.object({
        user: v.object({
          name: v.string(),
          email: v.string(),
        }),
        count: v.number(),
      });

      const _omitted = original.omit("count");

      // The fieldPaths should include nested paths
      // TypeScript will infer this correctly from the Fields parameter
      type FieldPaths = (typeof _omitted)["fieldPaths"];
      const _fieldPaths: FieldPaths = "user";
      const _fieldPaths2: FieldPaths = "user.name";
      const _fieldPaths3: FieldPaths = "user.email";
    });

    test("fieldPaths are correctly inferred after pick", () => {
      const original = v.object({
        user: v.object({
          name: v.string(),
          email: v.string(),
        }),
        count: v.number(),
      });

      const _picked = original.pick("user");

      // The fieldPaths should only include user paths
      type FieldPaths = (typeof _picked)["fieldPaths"];
      const _fieldPaths: FieldPaths = "user";
      const _fieldPaths2: FieldPaths = "user.name";
      const _fieldPaths3: FieldPaths = "user.email";
    });

    test("fieldPaths are correctly inferred after extend", () => {
      const original = v.object({
        a: v.string(),
      });

      const _extended = original.extend({
        b: v.object({
          c: v.number(),
        }),
      });

      // The fieldPaths should include both original and new paths
      type FieldPaths = (typeof _extended)["fieldPaths"];
      const _fieldPaths: FieldPaths = "a";
      const _fieldPaths2: FieldPaths = "b";
      const _fieldPaths3: FieldPaths = "b.c";
    });
  });
});
