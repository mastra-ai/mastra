import * as vite from 'vite';
import { resolveConfig as resolveConfig$1, mergeConfig } from 'vite';
export { esbuildVersion, isCSSRequest, isFileServingAllowed, parseAst, parseAstAsync, rollupVersion, version as viteVersion } from 'vite';
import { V as Vitest, a as VitestPlugin } from './chunks/cli-api.BQ-bjcRi.js';
export { f as ForksPoolWorker, G as GitNotFoundError, F as TestsNotFoundError, T as ThreadsPoolWorker, h as TypecheckPoolWorker, b as VitestPackageInstaller, j as VmForksPoolWorker, k as VmThreadsPoolWorker, o as createDebugger, d as createMethodsRPC, n as createViteLogger, c as createVitest, e as escapeTestName, l as experimental_getRunnerTask, g as getFilePoolName, i as isValidApiRequest, m as registerConsoleShortcuts, r as resolveFsAllow, s as startVitest } from './chunks/cli-api.BQ-bjcRi.js';
export { p as parseCLI } from './chunks/cac.CfkWq8Qy.js';
import { r as resolveConfig$2 } from './chunks/coverage.NVjCOln1.js';
export { b as BaseSequencer, a as resolveApiServerConfig } from './chunks/coverage.NVjCOln1.js';
import { slash, deepClone } from '@vitest/utils/helpers';
import { a as any } from './chunks/index.Dc3xnDvT.js';
import { resolve } from 'pathe';
import { c as configFiles } from './chunks/constants.D_Q9UYh-.js';
export { distDir, rootDir } from './path.js';
export { generateFileHash } from '@vitest/runner/utils';
import 'node:fs';
import './chunks/coverage.D_JHT54q.js';
import 'node:path';
import 'node:os';
import '@vitest/snapshot/manager';
import './chunks/index.DAL392Ss.js';
import './chunks/index.kotH7DY7.js';
import 'node:fs/promises';
import 'node:perf_hooks';
import '@vitest/utils/source-map';
import 'tinyrainbow';
import './chunks/env.D4Lgay0q.js';
import 'std-env';
import 'node:util';
import 'node:console';
import 'node:stream';
import '@vitest/utils/display';
import 'tinyexec';
import '@vitest/utils/offset';
import 'node:module';
import 'events';
import 'https';
import 'http';
import 'net';
import 'tls';
import 'crypto';
import 'stream';
import 'url';
import 'zlib';
import 'buffer';
import './chunks/_commonjsHelpers.BFTU3MAI.js';
import 'node:crypto';
import 'debug';
import '#module-evaluator';
import 'vite/module-runner';
import '@vitest/utils/highlight';
import 'node:url';
import 'node:tty';
import 'node:events';
import 'node:child_process';
import 'node:v8';
import 'node:worker_threads';
import 'picomatch';
import 'tinyglobby';
import 'magic-string';
import '@vitest/mocker/node';
import './chunks/defaults.BOqNVLsY.js';
import '@vitest/utils/constants';
import '@vitest/utils/resolver';
import 'es-module-lexer';
import './chunks/index.op2Re5rn.js';
import 'node:assert';
import '@vitest/utils/serialize';
import 'node:readline';
import 'node:process';
import 'readline';

// this is only exported as a public function and not used inside vitest
async function resolveConfig(options = {}, viteOverrides = {}) {
	const root = slash(resolve(options.root || process.cwd()));
	const configPath = options.config === false ? false : options.config ? resolve(root, options.config) : any(configFiles, { cwd: root });
	options.config = configPath;
	const vitest = new Vitest("test", deepClone(options));
	const config = await resolveConfig$1(mergeConfig({
		configFile: configPath,
		mode: options.mode || "test",
		plugins: [await VitestPlugin(options, vitest)]
	}, mergeConfig(viteOverrides, { root: options.root })), "serve");
	const vitestConfig = resolveConfig$2(vitest, Reflect.get(config, "_vitest"), config);
	await vitest.close();
	return {
		viteConfig: config,
		vitestConfig
	};
}

const version = Vitest.version;
const createViteServer = vite.createServer;
// rolldownVersion is exported only by rolldown-vite
const rolldownVersion = vite.rolldownVersion;

export { VitestPlugin, createViteServer, resolveConfig, rolldownVersion, version };
