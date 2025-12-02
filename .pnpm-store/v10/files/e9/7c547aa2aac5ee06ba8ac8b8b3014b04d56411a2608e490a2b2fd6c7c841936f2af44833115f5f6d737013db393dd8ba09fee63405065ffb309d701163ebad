import { test } from "vitest";
import { ApiFromModules, FunctionReference, justSchedulable } from "./api.js";
import { assert, Equals } from "../test/type_testing.js";
import {
  actionGeneric,
  mutationGeneric,
  queryGeneric,
} from "./impl/registration_impl.js";
import { EmptyObject } from "./registration.js";

const _myModule = {
  query: queryGeneric((_) => false),
  action: actionGeneric((_) => "result"),
  mutation: mutationGeneric((_) => 123),
};

type API = ApiFromModules<{
  myModule: typeof _myModule;
}>;

type SchedulableAPI = ReturnType<typeof justSchedulable<API>>;

test("SchedulableFunctionNames", () => {
  type Expected = {
    myModule: {
      action: FunctionReference<"action", "public", EmptyObject, string>;
      mutation: FunctionReference<"mutation", "public", EmptyObject, number>;
    };
  };
  assert<Equals<Expected, SchedulableAPI>>();
});
