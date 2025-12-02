/**
 * @vitest-environment custom-vitest-environment.ts
 */
import { test } from "vitest";
import React from "react";
import { ConvexProviderWithClerk } from "./ConvexProviderWithClerk.js";
import { ConvexReactClient } from "../react/index.js";
import { useAuth } from "@clerk/clerk-react";

test("Helpers are valid children", () => {
  const convex = new ConvexReactClient("https://localhost:3001");

  const _ = (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      Hello world
    </ConvexProviderWithClerk>
  );
});
