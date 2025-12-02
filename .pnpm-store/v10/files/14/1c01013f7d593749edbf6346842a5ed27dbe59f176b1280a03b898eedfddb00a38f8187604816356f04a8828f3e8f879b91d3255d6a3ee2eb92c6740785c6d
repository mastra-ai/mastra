// package.json
var name = "@mendable/firecrawl-js";
var version = "1.29.3";
var description = "JavaScript SDK for Firecrawl API";
var main = "dist/index.js";
var types = "dist/index.d.ts";
var exports = {
  "./package.json": "./package.json",
  ".": {
    import: "./dist/index.js",
    default: "./dist/index.cjs"
  }
};
var type = "module";
var scripts = {
  build: "tsup",
  "build-and-publish": "npm run build && npm publish --access public",
  "publish-beta": "npm run build && npm publish --access public --tag beta",
  test: "NODE_OPTIONS=--experimental-vm-modules jest --verbose src/__tests__/v1/**/*.test.ts",
  "test:unit": "NODE_OPTIONS=--experimental-vm-modules jest --verbose src/__tests__/v1/unit/*.test.ts"
};
var repository = {
  type: "git",
  url: "git+https://github.com/mendableai/firecrawl.git"
};
var author = "Mendable.ai";
var license = "MIT";
var dependencies = {
  axios: "^1.11.0",
  "typescript-event-target": "^1.1.1",
  zod: "^3.23.8",
  "zod-to-json-schema": "^3.23.0"
};
var bugs = {
  url: "https://github.com/mendableai/firecrawl/issues"
};
var homepage = "https://github.com/mendableai/firecrawl#readme";
var devDependencies = {
  "@jest/globals": "^30.0.5",
  "@types/dotenv": "^8.2.0",
  "@types/jest": "^30.0.0",
  "@types/mocha": "^10.0.6",
  "@types/node": "^20.12.12",
  "@types/uuid": "^9.0.8",
  dotenv: "^16.4.5",
  jest: "^30.0.5",
  "ts-jest": "^29.4.0",
  tsup: "^8.5.0",
  typescript: "^5.4.5",
  uuid: "^9.0.1"
};
var keywords = [
  "firecrawl",
  "mendable",
  "crawler",
  "web",
  "scraper",
  "api",
  "sdk"
];
var engines = {
  node: ">=22.0.0"
};
var pnpm = {
  overrides: {
    "@babel/helpers@<7.26.10": ">=7.26.10",
    "brace-expansion@>=1.0.0 <=1.1.11": ">=1.1.12",
    "brace-expansion@>=2.0.0 <=2.0.1": ">=2.0.2"
  }
};
var package_default = {
  name,
  version,
  description,
  main,
  types,
  exports,
  type,
  scripts,
  repository,
  author,
  license,
  dependencies,
  bugs,
  homepage,
  devDependencies,
  keywords,
  engines,
  pnpm
};
export {
  author,
  bugs,
  package_default as default,
  dependencies,
  description,
  devDependencies,
  engines,
  exports,
  homepage,
  keywords,
  license,
  main,
  name,
  pnpm,
  repository,
  scripts,
  type,
  types,
  version
};
