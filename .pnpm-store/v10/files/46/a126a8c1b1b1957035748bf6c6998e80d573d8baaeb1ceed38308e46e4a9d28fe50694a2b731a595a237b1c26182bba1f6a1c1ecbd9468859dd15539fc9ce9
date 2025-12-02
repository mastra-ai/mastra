/* eslint-disable @typescript-eslint/no-unused-vars */
import { assert, Equals } from "../test/type_testing.js";
import { describe, test } from "vitest";
import {
  makeFunctionReference,
  PaginationOptions,
  PaginationResult,
  QueryBuilder,
} from "./index.js";
import {
  FunctionReference,
  justActions,
  justInternal,
  justMutations,
  justQueries,
  justPaginatedQueries,
  PartialApi,
  ConvertReturnType,
} from "./api.js";

test("PartialApi", () => {
  const api = {
    foo: {
      a: makeFunctionReference<"query", { a: string }>("a"),
      b: makeFunctionReference<"query">("b"),
    },
    bar: {
      c: makeFunctionReference<"query">("c"),
      baz: {
        d: makeFunctionReference<"query">("d"),
        e: makeFunctionReference<"query">("e"),
      },
    },
  } as const;
  type API = typeof api;
  const subset = {
    foo: {
      b: makeFunctionReference<"query">("b"),
    },
    bar: {
      baz: {
        e: makeFunctionReference<"query">("e"),
      },
    },
  } as const;
  type SubsetAPI = typeof subset;
  assert<SubsetAPI extends PartialApi<API> ? true : false>;

  const notASubset = {
    foo: {
      c: makeFunctionReference<"query">("c"),
    },
  } as const;
  assert<typeof notASubset extends PartialApi<API> ? false : true>;

  const wrongSignature = {
    foo: {
      a: makeFunctionReference<"query", { a: number }>("a"),
    },
  } as const;
  assert<typeof wrongSignature extends PartialApi<API> ? false : true>;

  const correctSignature = {
    foo: {
      a: makeFunctionReference<"query", { a: string }>("a"),
    },
  } as const;
  assert<typeof correctSignature extends PartialApi<API> ? true : false>;
});

import {
  actionGeneric,
  mutationGeneric,
  queryGeneric,
  internalQueryGeneric,
  internalActionGeneric,
  internalMutationGeneric,
} from "../server/index.js";
import { ApiFromModules, ArgsAndOptions, OptionalRestArgs } from "./index.js";
import { DefaultFunctionArgs, EmptyObject } from "./registration.js";

describe("JustPaginatedQueries", () => {
  test("selects correct queries", () => {
    const query = queryGeneric as QueryBuilder<any, "public">;
    const modules = {
      filename: {
        simplePaginated: query(
          (
            _ctx,
            _args: {
              paginationOpts: PaginationOptions;
            },
          ) => null as unknown as PaginationResult<string>,
        ),
        paginatedWithArg: query(
          (
            _ctx,
            _args: {
              property: string;
              paginationOpts: PaginationOptions;
            },
          ) => null as unknown as PaginationResult<string>,
        ),
        missingArg: query(
          (_ctx) => null as unknown as PaginationResult<string>,
        ),
        emptyArg: query(() => null as unknown as PaginationResult<string>),
        wrongReturn: query(
          (_ctx, _args: { paginationOpts: PaginationOptions }) =>
            null as unknown as string,
        ),
      },
    } as const;
    type API = ApiFromModules<typeof modules>;
    type Expected = {
      filename: {
        simplePaginated: FunctionReference<
          "query",
          "public",
          { paginationOpts: PaginationOptions },
          PaginationResult<string>
        >;
        paginatedWithArg: FunctionReference<
          "query",
          "public",
          { paginationOpts: PaginationOptions; property: string },
          PaginationResult<string>
        >;
      };
    };
    const paginatedApi = justPaginatedQueries(null as unknown as API);
    type Actual = typeof paginatedApi;
    assert<
      Equals<
        Actual["filename"]["paginatedWithArg"],
        Expected["filename"]["paginatedWithArg"]
      >
    >();
  });
});

describe("justType filters", () => {
  test("finds queries, mutations and actions", () => {
    const myModule = {
      query: queryGeneric((_, _args: { arg: number }) => "query result"),
      mutation: mutationGeneric((_) => "query result"),
      importantQuestion: actionGeneric((_, _args: { arg: number }) => 42),
    };

    type API = ApiFromModules<{
      myModule: typeof myModule;
    }>;
    type ExpectedAPI = {
      myModule: {
        query: FunctionReference<
          "query",
          "public",
          {
            arg: number;
          },
          string
        >;
        mutation: FunctionReference<
          "mutation",
          "public",
          Record<string, never>,
          string
        >;
        importantQuestion: FunctionReference<
          "action",
          "public",
          { arg: number },
          number
        >;
      };
    };
    assert<Equals<API, ExpectedAPI>>;

    type jq = ReturnType<typeof justQueries<API>>;
    type jm = ReturnType<typeof justMutations<API>>;
    type ja = ReturnType<typeof justActions<API>>;
    assert<
      Equals<
        jq,
        {
          myModule: {
            query: FunctionReference<
              "query",
              "public",
              {
                arg: number;
              },
              string
            >;
          };
        }
      >
    >;
    assert<
      Equals<
        jm,
        {
          myModule: {
            mutation: FunctionReference<
              "mutation",
              "public",
              EmptyObject,
              string
            >;
          };
        }
      >
    >;
    assert<
      Equals<
        ja,
        {
          myModule: {
            importantQuestion: FunctionReference<
              "action",
              "public",
              {
                arg: number;
              },
              number
            >;
          };
        }
      >
    >;
  });

  test("ignores exports that aren't functions and modules that don't have them", () => {
    const myModule = {
      number: 123,
      function: () => "return value",
      object: { property: "value" },
    };
    type API = ApiFromModules<{
      myModule: typeof myModule;
    }>;
    // None of these exports are queries or mutations or actions.
    type ExpectedAPI = {};
    assert<Equals<API, ExpectedAPI>>;
  });

  test("applies return type conversions", () => {
    const myModule = {
      returnsPromise: queryGeneric(() => Promise.resolve("query result")),
      returnsUndefined: queryGeneric(() => undefined),
      returnsVoid: queryGeneric(() => {
        // Intentionally empty
      }),
      returnsVoidPromise: queryGeneric(() => Promise.resolve()),
    };

    type API = ApiFromModules<{
      myModule: typeof myModule;
    }>;
    type ExpectedAPI = {
      myModule: {
        returnsPromise: FunctionReference<
          "query",
          "public",
          EmptyObject,
          string
        >;
        returnsUndefined: FunctionReference<
          "query",
          "public",
          EmptyObject,
          null
        >;
        returnsVoid: FunctionReference<"query", "public", EmptyObject, null>;
        returnsVoidPromise: FunctionReference<
          "query",
          "public",
          EmptyObject,
          null
        >;
      };
    };
    assert<Equals<API, ExpectedAPI>>;
  });

  test("separates internal functions", () => {
    const myModule = {
      query: queryGeneric((_, _args: { arg: number }) => "query result"),
      internalQuery: internalQueryGeneric(
        (_, _args: { arg: number }) => "query result",
      ),
      mutation: mutationGeneric((_) => "query result"),
      internalMutation: internalMutationGeneric((_) => "query result"),
    };

    const myActionsModule = {
      action: actionGeneric((_, _args: { arg: number }) => 42),
      internalAction: internalActionGeneric((_, _args: { arg: number }) => 42),
    };

    type API = ApiFromModules<{
      myModule: typeof myModule;
      "actions/myActionsModule": typeof myActionsModule;
    }>;
    type InternalAPI = ReturnType<typeof justInternal<API>>;
    type ExpectedAPI = {
      myModule: {
        internalQuery: FunctionReference<
          "query",
          "internal",
          {
            arg: number;
          },
          string
        >;
        internalMutation: FunctionReference<
          "mutation",
          "internal",
          EmptyObject,
          string
        >;
      };
      actions: {
        myActionsModule: {
          internalAction: FunctionReference<
            "action",
            "internal",
            {
              arg: number;
            },
            number
          >;
        };
      };
    };
    assert<Equals<InternalAPI, ExpectedAPI>>;
  });

  test("correctly infers arguments", () => {
    const myModule = {
      noArg: queryGeneric((_) => "query result"),
      oneTypedArg: queryGeneric((_, _args: { arg: number }) => "query result"),
      onUnTypedArg: queryGeneric((_, _args) => "query result"),
    };

    type API = ApiFromModules<{
      myModule: typeof myModule;
    }>;
    type ExpectedAPI = {
      myModule: {
        noArg: FunctionReference<"query", "public", EmptyObject, string>;
        oneTypedArg: FunctionReference<
          "query",
          "public",
          {
            arg: number;
          },
          string
        >;
        onUnTypedArg: FunctionReference<
          "query",
          "public",
          DefaultFunctionArgs,
          string
        >;
      };
    };

    assert<Equals<API, ExpectedAPI>>;
  });
});

describe("Args", () => {
  const module = {
    noArgs: mutationGeneric((_ctx) => {
      /* nop */
    }),
    args: mutationGeneric((_ctx, _args: { property: string }) => {
      /* nop */
    }),
  };
  type API = ApiFromModules<{
    module: typeof module;
  }>;

  describe("ArgsObject", () => {
    test("infers Record<string, never> for functions with no args", () => {
      type MyFunction = API["module"]["noArgs"];
      assert<Equals<MyFunction["_args"], EmptyObject>>();
    });

    test("infers args for functions with args", () => {
      type MyFunction = API["module"]["args"];
      type ExpectedArgs = { property: string };
      assert<Equals<MyFunction["_args"], ExpectedArgs>>();
    });
  });

  describe("OptionalRestArgs", () => {
    test("infers rest type with optional args for functions with no args", () => {
      type MyFunction = API["module"]["noArgs"];
      type ExpectedArgs = [Record<string, never>?];
      type Args = OptionalRestArgs<MyFunction>;
      assert<Equals<Args, ExpectedArgs>>();
    });

    test("infers rest type with required args for functions with args", () => {
      type MyFunction = API["module"]["args"];
      type ExpectedArgs = [{ property: string }];
      type Args = OptionalRestArgs<MyFunction>;
      assert<Equals<Args, ExpectedArgs>>();
    });
  });

  describe("ArgsAndOptions", () => {
    type Options = {
      option1?: string;
      option2: number;
    };

    test("infers rest type with optional args and optional options for functions with no args", () => {
      type MyFunction = API["module"]["noArgs"];
      type ExpectedArgs = [Record<string, never>?, Options?];
      type Args = ArgsAndOptions<MyFunction, Options>;
      assert<Equals<Args, ExpectedArgs>>();
    });

    test("infers rest type with required args and optional options for functions with args", () => {
      type MyFunction = API["module"]["args"];
      type ExpectedArgs = [{ property: string }, Options?];
      type Args = ArgsAndOptions<MyFunction, Options>;
      assert<Equals<Args, ExpectedArgs>>();
    });
  });
});

test("ConvertReturnType", () => {
  assert<Equals<ConvertReturnType<undefined>, null>>;

  assert<Equals<ConvertReturnType<undefined | string>, null | string>>;

  assert<Equals<ConvertReturnType<Promise<undefined>>, null>>;

  assert<Equals<ConvertReturnType<Promise<undefined | string>>, null | string>>;

  assert<Equals<ConvertReturnType<Promise<string>>, string>>;
});
