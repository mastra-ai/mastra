import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertDatabaseIsolation,
  databaseProfile,
  isLocalMode,
  templateRoot,
} from "../config/app-mode.mjs";

const ports = {
  backend: Number(process.env.LOCAL_DEMO_BACKEND_PORT ?? "4111"),
  client: Number(process.env.LOCAL_DEMO_CLIENT_PORT ?? "3000"),
  support: Number(process.env.LOCAL_DEMO_SUPPORT_PORT ?? "5173"),
};
const children = [];
let stopping = false;
let interrupted = false;
let rejectFailure;
let resolveShutdown;
const failure = new Promise((_, reject) => {
  rejectFailure = reject;
});
failure.catch(() => undefined);
const shutdown = new Promise((resolve) => {
  resolveShutdown = resolve;
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function signalGroup(child, signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) signalGroup(child, "SIGTERM");
  resolveShutdown();
}
async function cleanup() {
  stop();
  const deadline = Date.now() + 3_000;
  const alive = () =>
    children.filter((child) => {
      if (!child.pid) return false;
      try {
        process.kill(-child.pid, 0);
        return true;
      } catch {
        return false;
      }
    });
  while (alive().length && Date.now() < deadline) await delay(50);
  for (const child of alive()) signalGroup(child, "SIGKILL");
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    interrupted = true;
    stop();
  });
function start(args, environment, persistent = false) {
  if (stopping) throw new Error("Local demo startup was interrupted.");
  const child = spawn("npm", args, {
    cwd: templateRoot,
    env: environment,
    stdio: "inherit",
    detached: true,
  });
  children.push(child);
  const completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (persistent && !stopping)
        reject(
          new Error(
            `Local demo process ${args.join(" ")} exited unexpectedly (${code ?? signal}).`,
          ),
        );
      else if (code === 0 || stopping) resolve();
      else
        reject(
          new Error(
            `Local demo process ${args.join(" ")} failed (${code ?? signal}).`,
          ),
        );
    });
  });
  completion.catch((error) => {
    rejectFailure(error);
    stop();
  });
  return { child, completion };
}
async function probe(port, name) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) =>
      reject(
        new Error(
          error.code === "EADDRINUSE"
            ? `${name} port ${port} is already in use. Select a distinct LOCAL_DEMO_*_PORT; no running server was stopped.`
            : `${name} port ${port} cannot be probed (${error.code}). Check loopback bind permission; no running server was stopped.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
async function secrets() {
  const directory = resolve(templateRoot, ".data");
  const filename = resolve(directory, "local-demo.env");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let stored;
  if (existsSync(filename)) {
    stored = Object.fromEntries(
      (await readFile(filename, "utf8")).split(/\r?\n/).flatMap((line) => {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
        return match ? [[match[1], match[2]]] : [];
      }),
    );
  } else {
    stored = Object.fromEntries(
      ["LOCAL_AUTH_SIGNING_KEY", "DEMO_AUTH_BRIDGE_SIGNING_KEY"].map((name) => [
        name,
        randomBytes(32).toString("base64url"),
      ]),
    );
    await writeFile(
      filename,
      Object.entries(stored)
        .map(([name, value]) => `${name}=${value}\n`)
        .join(""),
      { mode: 0o600, flag: "wx" },
    );
  }
  const result = {};
  for (const name of [
    "LOCAL_AUTH_SIGNING_KEY",
    "DEMO_AUTH_BRIDGE_SIGNING_KEY",
  ]) {
    result[name] = process.env[name]?.trim() || stored[name];
    if (!result[name] || result[name].length < 32)
      throw new Error(
        `${name} must contain at least 32 characters. Check .env or .data/local-demo.env.`,
      );
  }
  return result;
}
async function ready(url, child, name) {
  const deadline = Date.now() + 60_000;
  while (!stopping && Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode)
      throw new Error(`${name} exited before becoming ready.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.status === 200) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`${name} did not become ready at ${url}.`);
}
const sqliteSidecars = ["", "-wal", "-shm", "-journal"];
const sqliteHeader = Buffer.from("SQLite format 3\0");

function sqliteArtifacts(url, label) {
  if (!url.startsWith("file:") || url.includes(":memory:"))
    throw new Error(`${label} must be a persistent SQLite file URL.`);
  const main = resolve(fileURLToPath(url));
  return sqliteSidecars.map((suffix) => `${main}${suffix}`);
}

function normalizedFileUrl(url, root) {
  return new URL(url, pathToFileURL(`${root}/`)).href;
}

function configuredExternalArtifacts(environment) {
  const external = databaseProfile({ ...environment, APP_MODE: "staging" });
  const urls = [
    [external.backend, templateRoot],
    [external.client, resolve(templateRoot, "client-demo-ui")],
  ];
  return urls.flatMap(([url, root]) => {
    if (!url.startsWith("file:") || url.includes(":memory:")) return [];
    return sqliteArtifacts(normalizedFileUrl(url, root), "External database");
  });
}

async function canonicalArtifactPath(path) {
  try {
    return resolve(await realpath(dirname(path)), basename(path));
  } catch (error) {
    if (error?.code === "ENOENT") return resolve(path);
    throw error;
  }
}

async function artifactDetails(path, followSymlink = false) {
  try {
    return await (followSymlink ? stat(path) : lstat(path));
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function sameArtifact(left, right) {
  return !!left && !!right && left.dev === right.dev && left.ino === right.ino;
}

async function validateSqliteMain(path, details) {
  // SQLite can leave an empty main file before its first schema write. A
  // non-empty selected main must identify itself before the launcher removes it.
  if (!details || details.size === 0) return;
  const handle = await open(path, "r");
  try {
    const header = Buffer.alloc(sqliteHeader.length);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead !== sqliteHeader.length || !header.equals(sqliteHeader))
      throw new Error(`Refusing to reset non-SQLite local database: ${path}`);
  } finally {
    await handle.close();
  }
}

async function resetLocalDatabases(profile, environment) {
  const mainPaths = [
    sqliteArtifacts(profile.backend, "Local backend database")[0],
    sqliteArtifacts(profile.client, "Local client database")[0],
  ];
  const targets = [
    ...sqliteArtifacts(profile.backend, "Local backend database"),
    ...sqliteArtifacts(profile.client, "Local client database"),
  ];
  const external = configuredExternalArtifacts(environment);
  const protectedArtifacts = [
    resolve(templateRoot, ".env"),
    resolve(templateRoot, ".data", "local-demo.env"),
  ];
  const [
    targetPaths,
    externalPaths,
    protectedPaths,
    targetDetails,
    externalDetails,
    protectedDetails,
  ] = await Promise.all([
    Promise.all(targets.map(canonicalArtifactPath)),
    Promise.all(external.map(canonicalArtifactPath)),
    Promise.all(protectedArtifacts.map(canonicalArtifactPath)),
    Promise.all(targets.map(artifactDetails)),
    Promise.all(external.map((path) => artifactDetails(path, true))),
    Promise.all(protectedArtifacts.map((path) => artifactDetails(path, true))),
  ]);
  if (new Set(targetPaths).size !== targetPaths.length)
    throw new Error("Local database reset targets must not overlap.");
  for (const [index, target] of targets.entries()) {
    const details = targetDetails[index];
    if (details && (details.isSymbolicLink() || !details.isFile()))
      throw new Error(
        `Refusing to reset unsafe local database artifact: ${target}`,
      );
  }
  await Promise.all(
    mainPaths.map((path, index) =>
      validateSqliteMain(path, targetDetails[index * 4]),
    ),
  );
  for (const [index, target] of targets.entries()) {
    const details = targetDetails[index];
    if (
      externalPaths.includes(targetPaths[index]) ||
      externalDetails.some((other) => sameArtifact(details, other))
    )
      throw new Error(
        "Local database reset targets must not overlap external databases.",
      );
    if (
      protectedPaths.includes(targetPaths[index]) ||
      protectedDetails.some((other) => sameArtifact(details, other))
    )
      throw new Error(
        "Local database reset targets must not include configuration files.",
      );
  }
  await Promise.all(
    targets.map(async (target, index) => {
      if (!targetDetails[index]) return;
      try {
        await unlink(target);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }),
  );
}

async function main() {
  if (!isLocalMode())
    throw new Error(
      "demo:local requires APP_MODE=local. Use the existing dev commands for staging or production.",
    );
  if (!process.env.OPENAI_API_KEY?.trim())
    throw new Error("OPENAI_API_KEY is required for npm run demo:local.");
  for (const [name, port] of Object.entries(ports)) {
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error(
        `LOCAL_DEMO_${name.toUpperCase()}_PORT must be a valid TCP port.`,
      );
  }
  if (new Set(Object.values(ports)).size !== 3)
    throw new Error("LOCAL_DEMO_*_PORT values must be distinct.");
  const environment = {
    ...process.env,
    APP_MODE: "local",
    TEMPLATE_ROOT: templateRoot,
    LOCAL_DEMO_BACKEND_PORT: String(ports.backend),
    LOCAL_DEMO_BACKEND_URL: `http://127.0.0.1:${ports.backend}`,
    DEMO_PORT: String(ports.client),
    E2E_API_PORT: String(ports.backend),
    LOCAL_DEMO_SEED_AT:
      process.env.LOCAL_DEMO_SEED_AT ?? new Date().toISOString(),
  };
  const profile = assertDatabaseIsolation(environment);
  await Promise.all(
    Object.entries(ports).map(([name, port]) => probe(port, name)),
  );
  Object.assign(environment, await secrets());
  await resetLocalDatabases(profile, environment);
  for (const url of [profile.backend, profile.client])
    await mkdir(dirname(fileURLToPath(url)), { recursive: true });
  await start(["run", "local:seed"], environment).completion;
  await start(
    ["run", "--workspace", "client-demo-ui", "local:seed"],
    environment,
  ).completion;
  const backend = start(["run", "dev"], environment, true).child;
  const client = start(["run", "dev:client-demo"], environment, true).child;
  const support = start(
    [
      "run",
      "dev:support-demo",
      "--",
      "--host",
      "127.0.0.1",
      "--strictPort",
      "--port",
      String(ports.support),
    ],
    environment,
    true,
  ).child;
  await Promise.race([
    failure,
    shutdown.then(() => {
      throw new Error("Startup stopped.");
    }),
    Promise.all([
      ready(
        `http://127.0.0.1:${ports.backend}/health`,
        backend,
        "Mastra backend",
      ),
      ready(`http://127.0.0.1:${ports.client}/`, client, "customer demo"),
      ready(`http://127.0.0.1:${ports.support}/`, support, "support demo"),
    ]),
  ]);
  console.log(
    `Local demo ready: customer http://127.0.0.1:${ports.client}, support http://127.0.0.1:${ports.support}, backend http://127.0.0.1:${ports.backend}`,
  );
  await Promise.race([failure, shutdown]);
}
try {
  await main();
} catch (error) {
  if (!interrupted) {
    console.error(error.message);
    process.exitCode = 1;
  }
} finally {
  await cleanup();
}
