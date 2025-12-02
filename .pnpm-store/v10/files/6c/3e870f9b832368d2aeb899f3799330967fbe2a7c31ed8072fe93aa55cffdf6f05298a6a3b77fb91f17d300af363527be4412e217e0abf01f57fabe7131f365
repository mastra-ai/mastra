/**
 * @vitest-environment custom-vitest-environment.ts
 */
import { test } from "vitest";
import React from "react";
import { ConvexProviderWithAuth0 } from "./ConvexProviderWithAuth0.js";
import { ConvexReactClient } from "../react/index.js";

test("Helpers are valid children", () => {
  const convex = new ConvexReactClient("https://localhost:3001");

  const _ = (
    <ConvexProviderWithAuth0 client={convex}>
      Hello world
    </ConvexProviderWithAuth0>
  );
});
