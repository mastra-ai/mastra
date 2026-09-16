import { supportsNode, supportsNpm } from "./runtime-range.mjs";

const expectedNode = "^22.22.0 || >=24.15.0";
const expectedNpm = ">=10.9.0";
const npmUserAgent = process.env.npm_config_user_agent ?? "";

if (!supportsNode(process.version)) {
  throw new Error(
    `Expected Node.js ${expectedNode}, received ${process.version}.`,
  );
}

const npmMatch = /^npm\/(\d+\.\d+\.\d+) node\/(v\d+\.\d+\.\d+)\b/.exec(
  npmUserAgent,
);
if (!npmMatch) {
  throw new Error(
    "npm_config_user_agent is missing the npm and Node.js versions.",
  );
}
if (!supportsNpm(npmMatch[1]) || !supportsNode(npmMatch[2])) {
  throw new Error(
    `Expected npm ${expectedNpm} on Node.js ${expectedNode}, received ${npmMatch[1]} on ${npmMatch[2]}.`,
  );
}

console.log(
  `Runtime verified: Node.js ${process.version}, npm ${npmMatch[1]}.`,
);
