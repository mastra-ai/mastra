import ESM_COMPAT_Module from "node:module";
import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
import { dirname as ESM_COMPAT_dirname } from 'node:path';
const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
const __dirname = ESM_COMPAT_dirname(__filename);
const require = ESM_COMPAT_Module.createRequire(import.meta.url);
var s = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(e, {
  get: (i, o) => (typeof require < "u" ? require : i)[o]
}) : e)(function(e) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + e + '" is not supported');
});

// src/bin/index.ts
import { spawn as c } from "node:child_process";
import { readFileSync as k } from "node:fs";
import { dirname as n, join as y } from "node:path";

// src/common/versions.ts
var r = {
  "@storybook/addon-a11y": "9.1.13",
  "@storybook/addon-docs": "9.1.13",
  "@storybook/addon-jest": "9.1.13",
  "@storybook/addon-links": "9.1.13",
  "@storybook/addon-onboarding": "9.1.13",
  "storybook-addon-pseudo-states": "9.1.13",
  "@storybook/addon-themes": "9.1.13",
  "@storybook/addon-vitest": "9.1.13",
  "@storybook/builder-vite": "9.1.13",
  "@storybook/builder-webpack5": "9.1.13",
  storybook: "9.1.13",
  "@storybook/angular": "9.1.13",
  "@storybook/ember": "9.1.13",
  "@storybook/html-vite": "9.1.13",
  "@storybook/nextjs": "9.1.13",
  "@storybook/nextjs-vite": "9.1.13",
  "@storybook/preact-vite": "9.1.13",
  "@storybook/react-native-web-vite": "9.1.13",
  "@storybook/react-vite": "9.1.13",
  "@storybook/react-webpack5": "9.1.13",
  "@storybook/server-webpack5": "9.1.13",
  "@storybook/svelte-vite": "9.1.13",
  "@storybook/sveltekit": "9.1.13",
  "@storybook/vue3-vite": "9.1.13",
  "@storybook/web-components-vite": "9.1.13",
  sb: "9.1.13",
  "@storybook/cli": "9.1.13",
  "@storybook/codemod": "9.1.13",
  "@storybook/core-webpack": "9.1.13",
  "create-storybook": "9.1.13",
  "@storybook/csf-plugin": "9.1.13",
  "eslint-plugin-storybook": "9.1.13",
  "@storybook/react-dom-shim": "9.1.13",
  "@storybook/preset-create-react-app": "9.1.13",
  "@storybook/preset-react-webpack": "9.1.13",
  "@storybook/preset-server-webpack": "9.1.13",
  "@storybook/html": "9.1.13",
  "@storybook/preact": "9.1.13",
  "@storybook/react": "9.1.13",
  "@storybook/server": "9.1.13",
  "@storybook/svelte": "9.1.13",
  "@storybook/vue3": "9.1.13",
  "@storybook/web-components": "9.1.13"
};

// src/bin/index.ts
var t = process.argv.slice(2);
if (["dev", "build", "index"].includes(t[0]))
  s("storybook/internal/cli/bin");
else {
  let e;
  if (t[0] === "init") {
    let o;
    try {
      o = s.resolve("create-storybook/package.json");
    } catch {
    }
    o ? JSON.parse(k(o, "utf-8")).version === r["create-storybook"] && (e = [
      "node",
      y(n(o), "bin", "index.cjs"),
      ...t.slice(1)
    ]) : e = ["npx", "--yes", `create-storybook@${r.storybook}`, ...t.slice(1)];
  } else {
    let o;
    try {
      o = s.resolve("@storybook/cli/package.json");
    } catch {
    }
    o ? JSON.parse(k(o, "utf-8")).version === r["@storybook/cli"] && (e = ["node", y(n(o), "bin", "index.cjs"), ...t]) : e = ["npx", "--yes",
    `@storybook/cli@${r.storybook}`, ...t];
  }
  e || (console.error("Could not run storybook cli, please report this as a bug"), process.exit(1)), c(e[0], e.slice(1), { stdio: "inherit",
  shell: !0 }).on("exit", (o) => {
    o != null && process.exit(o), process.exit(1);
  });
}
