import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import * as vite from "vite";
import { createFilter } from "vite";
import { exactRegex, makeIdFiltersToMatchWithQuery } from "@rolldown/pluginutils";

//#region ../common/refresh-utils.ts
const runtimePublicPath = "/@react-refresh";
const reactCompRE = /extends\s+(?:React\.)?(?:Pure)?Component/;
const refreshContentRE = /\$RefreshReg\$\(/;
const preambleCode = `import { injectIntoGlobalHook } from "__BASE__${runtimePublicPath.slice(1)}";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;`;
const getPreambleCode = (base) => preambleCode.replace("__BASE__", base);
function addRefreshWrapper(code, pluginName, id, reactRefreshHost = "") {
	const hasRefresh = refreshContentRE.test(code);
	const onlyReactComp = !hasRefresh && reactCompRE.test(code);
	if (!hasRefresh && !onlyReactComp) return void 0;
	let newCode = code;
	newCode += `

import * as RefreshRuntime from "${reactRefreshHost}${runtimePublicPath}";
const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "${pluginName} can't detect preamble. Something is wrong."
    );
  }

  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh(${JSON.stringify(id)}, currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate(${JSON.stringify(id)}, currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
`;
	if (hasRefresh) newCode += `function $RefreshReg$(type, id) { return RefreshRuntime.register(type, ${JSON.stringify(id)} + ' ' + id) }
function $RefreshSig$() { return RefreshRuntime.createSignatureFunctionForTransform(); }
`;
	return newCode;
}

//#endregion
//#region ../common/warning.ts
const silenceUseClientWarning = (userConfig) => ({ rollupOptions: { onwarn(warning, defaultHandler) {
	if (warning.code === "MODULE_LEVEL_DIRECTIVE" && (warning.message.includes("use client") || warning.message.includes("use server"))) return;
	if (warning.code === "SOURCEMAP_ERROR" && warning.message.includes("resolve original location") && warning.pos === 0) return;
	if (userConfig.build?.rollupOptions?.onwarn) userConfig.build.rollupOptions.onwarn(warning, defaultHandler);
	else defaultHandler(warning);
} } });

//#endregion
//#region src/index.ts
const _dirname = dirname(fileURLToPath(import.meta.url));
const refreshRuntimePath = join(_dirname, "refresh-runtime.js");
let babel;
async function loadBabel() {
	if (!babel) babel = await import("@babel/core");
	return babel;
}
const defaultIncludeRE = /\.[tj]sx?$/;
const defaultExcludeRE = /\/node_modules\//;
const tsRE = /\.tsx?$/;
const compilerAnnotationRE = /['"]use memo['"]/;
function viteReact(opts = {}) {
	const include = opts.include ?? defaultIncludeRE;
	const exclude = opts.exclude ?? defaultExcludeRE;
	const filter = createFilter(include, exclude);
	const jsxImportSource = opts.jsxImportSource ?? "react";
	const jsxImportRuntime = `${jsxImportSource}/jsx-runtime`;
	const jsxImportDevRuntime = `${jsxImportSource}/jsx-dev-runtime`;
	const isRolldownVite = "rolldownVersion" in vite;
	let runningInVite = false;
	let isProduction = true;
	let projectRoot = process.cwd();
	let skipFastRefresh = true;
	let base;
	let isFullBundle = false;
	let runPluginOverrides;
	let staticBabelOptions;
	const importReactRE = /\bimport\s+(?:\*\s+as\s+)?React\b/;
	const viteBabel = {
		name: "vite:react-babel",
		enforce: "pre",
		config(_userConfig, { command }) {
			if ("rolldownVersion" in vite) if (opts.jsxRuntime === "classic") return { oxc: {
				jsx: {
					runtime: "classic",
					refresh: command === "serve",
					development: false
				},
				jsxRefreshInclude: makeIdFiltersToMatchWithQuery(include),
				jsxRefreshExclude: makeIdFiltersToMatchWithQuery(exclude)
			} };
			else return {
				oxc: {
					jsx: {
						runtime: "automatic",
						importSource: opts.jsxImportSource,
						refresh: command === "serve"
					},
					jsxRefreshInclude: makeIdFiltersToMatchWithQuery(include),
					jsxRefreshExclude: makeIdFiltersToMatchWithQuery(exclude)
				},
				optimizeDeps: { rollupOptions: { transform: { jsx: { runtime: "automatic" } } } }
			};
			if (opts.jsxRuntime === "classic") return { esbuild: { jsx: "transform" } };
			else return {
				esbuild: {
					jsx: "automatic",
					jsxImportSource: opts.jsxImportSource
				},
				optimizeDeps: { esbuildOptions: { jsx: "automatic" } }
			};
		},
		configResolved(config) {
			runningInVite = true;
			base = config.base;
			if (config.experimental.fullBundleMode) isFullBundle = true;
			projectRoot = config.root;
			isProduction = config.isProduction;
			skipFastRefresh = isProduction || config.command === "build" || config.server.hmr === false;
			const hooks = config.plugins.map((plugin) => plugin.api?.reactBabel).filter(defined);
			if (hooks.length > 0) runPluginOverrides = (babelOptions, context) => {
				hooks.forEach((hook) => hook(babelOptions, context, config));
			};
			else if (typeof opts.babel !== "function") {
				staticBabelOptions = createBabelOptions(opts.babel);
				if ((isRolldownVite || skipFastRefresh) && canSkipBabel(staticBabelOptions.plugins, staticBabelOptions) && (opts.jsxRuntime === "classic" ? isProduction : true)) delete viteBabel.transform;
			}
		},
		options(options) {
			if (!runningInVite) {
				options.jsx = {
					mode: opts.jsxRuntime,
					importSource: opts.jsxImportSource
				};
				return options;
			}
		},
		transform: {
			filter: { id: {
				include: makeIdFiltersToMatchWithQuery(include),
				exclude: makeIdFiltersToMatchWithQuery(exclude)
			} },
			async handler(code, id, options) {
				const [filepath] = id.split("?");
				if (!filter(filepath)) return;
				const ssr = options?.ssr === true;
				const babelOptions = (() => {
					if (staticBabelOptions) return staticBabelOptions;
					const newBabelOptions = createBabelOptions(typeof opts.babel === "function" ? opts.babel(id, { ssr }) : opts.babel);
					runPluginOverrides?.(newBabelOptions, {
						id,
						ssr
					});
					return newBabelOptions;
				})();
				const plugins = [...babelOptions.plugins];
				let reactCompilerPlugin$1 = getReactCompilerPlugin(plugins);
				if (reactCompilerPlugin$1 && ssr) {
					plugins.splice(plugins.indexOf(reactCompilerPlugin$1), 1);
					reactCompilerPlugin$1 = void 0;
				}
				if (Array.isArray(reactCompilerPlugin$1) && reactCompilerPlugin$1[1]?.compilationMode === "annotation" && !compilerAnnotationRE.test(code)) {
					plugins.splice(plugins.indexOf(reactCompilerPlugin$1), 1);
					reactCompilerPlugin$1 = void 0;
				}
				const isJSX = filepath.endsWith("x");
				const useFastRefresh = !(isRolldownVite || skipFastRefresh) && !ssr && (isJSX || (opts.jsxRuntime === "classic" ? importReactRE.test(code) : code.includes(jsxImportDevRuntime) || code.includes(jsxImportRuntime)));
				if (useFastRefresh) plugins.push([await loadPlugin("react-refresh/babel"), { skipEnvCheck: true }]);
				if (opts.jsxRuntime === "classic" && isJSX) {
					if (!isProduction) plugins.push(await loadPlugin("@babel/plugin-transform-react-jsx-self"), await loadPlugin("@babel/plugin-transform-react-jsx-source"));
				}
				if (canSkipBabel(plugins, babelOptions)) return;
				const parserPlugins = [...babelOptions.parserOpts.plugins];
				if (!filepath.endsWith(".ts")) parserPlugins.push("jsx");
				if (tsRE.test(filepath)) parserPlugins.push("typescript");
				const result = await (await loadBabel()).transformAsync(code, {
					...babelOptions,
					root: projectRoot,
					filename: id,
					sourceFileName: filepath,
					retainLines: reactCompilerPlugin$1 ? false : !isProduction && isJSX && opts.jsxRuntime !== "classic",
					parserOpts: {
						...babelOptions.parserOpts,
						sourceType: "module",
						allowAwaitOutsideFunction: true,
						plugins: parserPlugins
					},
					generatorOpts: {
						...babelOptions.generatorOpts,
						importAttributesKeyword: "with",
						decoratorsBeforeExport: true
					},
					plugins,
					sourceMaps: true
				});
				if (result) {
					if (!useFastRefresh) return {
						code: result.code,
						map: result.map
					};
					return {
						code: addRefreshWrapper(result.code, "@vitejs/plugin-react", id, opts.reactRefreshHost) ?? result.code,
						map: result.map
					};
				}
			}
		}
	};
	const viteRefreshWrapper = {
		name: "vite:react:refresh-wrapper",
		apply: "serve",
		async applyToEnvironment(env) {
			if (env.config.consumer !== "client" || skipFastRefresh) return false;
			let nativePlugin;
			try {
				nativePlugin = (await import("vite/internal")).reactRefreshWrapperPlugin;
			} catch {}
			if (!nativePlugin || [
				"7.1.10",
				"7.1.11",
				"7.1.12"
			].includes(vite.version)) return true;
			delete viteRefreshWrapper.transform;
			return nativePlugin({
				cwd: process.cwd(),
				include: makeIdFiltersToMatchWithQuery(include),
				exclude: makeIdFiltersToMatchWithQuery(exclude),
				jsxImportSource,
				reactRefreshHost: opts.reactRefreshHost ?? ""
			});
		},
		transform: {
			filter: { id: {
				include: makeIdFiltersToMatchWithQuery(include),
				exclude: makeIdFiltersToMatchWithQuery(exclude)
			} },
			handler(code, id, options) {
				const ssr = options?.ssr === true;
				const [filepath] = id.split("?");
				const isJSX = filepath.endsWith("x");
				if (!(!skipFastRefresh && !ssr && (isJSX || code.includes(jsxImportDevRuntime) || code.includes(jsxImportRuntime)))) return;
				const newCode = addRefreshWrapper(code, "@vitejs/plugin-react", id, opts.reactRefreshHost);
				return newCode ? {
					code: newCode,
					map: null
				} : void 0;
			}
		}
	};
	const viteConfigPost = {
		name: "vite:react:config-post",
		enforce: "post",
		config(userConfig) {
			if (userConfig.server?.hmr === false) return { oxc: { jsx: { refresh: false } } };
		}
	};
	const viteReactRefreshFullBundleMode = {
		name: "vite:react-refresh-fbm",
		enforce: "pre",
		transformIndexHtml: {
			handler() {
				if (!skipFastRefresh && isFullBundle) return [{
					tag: "script",
					attrs: { type: "module" },
					children: getPreambleCode(base)
				}];
			},
			order: "pre"
		}
	};
	const dependencies = [
		"react",
		"react-dom",
		jsxImportDevRuntime,
		jsxImportRuntime
	];
	const staticBabelPlugins = typeof opts.babel === "object" ? opts.babel?.plugins ?? [] : [];
	const reactCompilerPlugin = getReactCompilerPlugin(staticBabelPlugins);
	if (reactCompilerPlugin != null) {
		const reactCompilerRuntimeModule = getReactCompilerRuntimeModule(reactCompilerPlugin);
		dependencies.push(reactCompilerRuntimeModule);
	}
	const viteReactRefresh = {
		name: "vite:react-refresh",
		enforce: "pre",
		config: (userConfig) => ({
			build: silenceUseClientWarning(userConfig),
			optimizeDeps: { include: dependencies }
		}),
		resolveId: {
			filter: { id: exactRegex(runtimePublicPath) },
			handler(id) {
				if (id === runtimePublicPath) return id;
			}
		},
		load: {
			filter: { id: exactRegex(runtimePublicPath) },
			handler(id) {
				if (id === runtimePublicPath) return readFileSync(refreshRuntimePath, "utf-8").replace(/__README_URL__/g, "https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react");
			}
		},
		transformIndexHtml() {
			if (!skipFastRefresh && !isFullBundle) return [{
				tag: "script",
				attrs: { type: "module" },
				children: getPreambleCode(base)
			}];
		}
	};
	return [
		viteBabel,
		...isRolldownVite ? [
			viteRefreshWrapper,
			viteConfigPost,
			viteReactRefreshFullBundleMode
		] : [],
		viteReactRefresh
	];
}
viteReact.preambleCode = preambleCode;
function viteReactForCjs(options) {
	return viteReact.call(this, options);
}
Object.assign(viteReactForCjs, { default: viteReactForCjs });
function canSkipBabel(plugins, babelOptions) {
	return !(plugins.length || babelOptions.presets.length || babelOptions.configFile || babelOptions.babelrc);
}
const loadedPlugin = /* @__PURE__ */ new Map();
function loadPlugin(path) {
	const cached = loadedPlugin.get(path);
	if (cached) return cached;
	const promise = import(path).then((module) => {
		const value = module.default || module;
		loadedPlugin.set(path, value);
		return value;
	});
	loadedPlugin.set(path, promise);
	return promise;
}
function createBabelOptions(rawOptions) {
	const babelOptions = {
		babelrc: false,
		configFile: false,
		...rawOptions
	};
	babelOptions.plugins ||= [];
	babelOptions.presets ||= [];
	babelOptions.overrides ||= [];
	babelOptions.parserOpts ||= {};
	babelOptions.parserOpts.plugins ||= [];
	return babelOptions;
}
function defined(value) {
	return value !== void 0;
}
function getReactCompilerPlugin(plugins) {
	return plugins.find((p) => p === "babel-plugin-react-compiler" || Array.isArray(p) && p[0] === "babel-plugin-react-compiler");
}
function getReactCompilerRuntimeModule(plugin) {
	let moduleName = "react/compiler-runtime";
	if (Array.isArray(plugin)) {
		if (plugin[1]?.target === "17" || plugin[1]?.target === "18") moduleName = "react-compiler-runtime";
	}
	return moduleName;
}

//#endregion
export { viteReact as default, viteReactForCjs as "module.exports" };