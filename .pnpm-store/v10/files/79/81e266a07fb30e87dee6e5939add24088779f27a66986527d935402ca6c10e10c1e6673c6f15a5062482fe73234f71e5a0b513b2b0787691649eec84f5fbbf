import { test } from "vitest";
import { tsconfigCodegen } from "./tsconfig.js";
import { readmeCodegen } from "./readme.js";

import prettier from "prettier";

test("templates parse", async () => {
  await prettier.format(tsconfigCodegen(), {
    parser: "json",
    pluginSearchDirs: false,
  });
  await prettier.format(readmeCodegen(), {
    parser: "markdown",
    pluginSearchDirs: false,
  });
});
