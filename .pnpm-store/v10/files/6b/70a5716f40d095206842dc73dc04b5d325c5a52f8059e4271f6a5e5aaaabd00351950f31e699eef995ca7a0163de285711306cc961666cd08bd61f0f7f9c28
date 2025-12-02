import { isBuiltin, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { isAbsolute } from 'pathe';
import { ssrModuleExportsKey, ssrImportMetaKey, ssrImportKey, ssrDynamicImportKey, ssrExportAllKey } from 'vite/module-runner';

const performanceNow = performance.now.bind(performance);
class ModuleDebug {
	executionStack = [];
	startCalculateModuleExecutionInfo(filename, startOffset) {
		const startTime = performanceNow();
		this.executionStack.push({
			filename,
			startTime,
			subImportTime: 0
		});
		return () => {
			const duration = performanceNow() - startTime;
			const currentExecution = this.executionStack.pop();
			if (currentExecution == null) throw new Error("Execution stack is empty, this should never happen");
			const selfTime = duration - currentExecution.subImportTime;
			if (this.executionStack.length > 0) this.executionStack.at(-1).subImportTime += duration;
			return {
				startOffset,
				duration,
				selfTime
			};
		};
	}
}

const isWindows = process.platform === "win32";
class VitestModuleEvaluator {
	stubs = {};
	env = createImportMetaEnvProxy();
	vm;
	compiledFunctionArgumentsNames;
	compiledFunctionArgumentsValues = [];
	primitives;
	debug = new ModuleDebug();
	constructor(vmOptions, options = {}) {
		this.options = options;
		this.vm = vmOptions;
		this.stubs = getDefaultRequestStubs(vmOptions?.context);
		if (options.compiledFunctionArgumentsNames) this.compiledFunctionArgumentsNames = options.compiledFunctionArgumentsNames;
		if (options.compiledFunctionArgumentsValues) this.compiledFunctionArgumentsValues = options.compiledFunctionArgumentsValues;
		if (vmOptions) this.primitives = vm.runInContext("({ Object, Proxy, Reflect })", vmOptions.context);
		else this.primitives = {
			Object,
			Proxy,
			Reflect
		};
	}
	convertIdToImportUrl(id) {
		// TODO: vitest returns paths for external modules, but Vite returns file://
		// unfortunetly, there is a bug in Vite where ID is resolved incorrectly, so we can't return files until the fix is merged
		// https://github.com/vitejs/vite/pull/20449
		if (!isWindows || isBuiltin(id) || /^(?:node:|data:|http:|https:|file:)/.test(id)) return id;
		const [filepath, query] = id.split("?");
		if (query) return `${pathToFileURL(filepath).toString()}?${query}`;
		return pathToFileURL(filepath).toString();
	}
	async runExternalModule(id) {
		if (id in this.stubs) return this.stubs[id];
		const file = this.convertIdToImportUrl(id);
		const namespace = this.vm ? await this.vm.externalModulesExecutor.import(file) : await import(file);
		if (!this.shouldInterop(file, namespace)) return namespace;
		const { mod, defaultExport } = interopModule(namespace);
		const { Proxy, Reflect } = this.primitives;
		return new Proxy(mod, {
			get(mod, prop) {
				if (prop === "default") return defaultExport;
				return mod[prop] ?? defaultExport?.[prop];
			},
			has(mod, prop) {
				if (prop === "default") return defaultExport !== void 0;
				return prop in mod || defaultExport && prop in defaultExport;
			},
			getOwnPropertyDescriptor(mod, prop) {
				const descriptor = Reflect.getOwnPropertyDescriptor(mod, prop);
				if (descriptor) return descriptor;
				if (prop === "default" && defaultExport !== void 0) return {
					value: defaultExport,
					enumerable: true,
					configurable: true
				};
			}
		});
	}
	async runInlinedModule(context, code, module) {
		context.__vite_ssr_import_meta__.env = this.env;
		const { Reflect, Proxy, Object } = this.primitives;
		const exportsObject = context[ssrModuleExportsKey];
		const SYMBOL_NOT_DEFINED = Symbol("not defined");
		let moduleExports = SYMBOL_NOT_DEFINED;
		// this proxy is triggered only on exports.{name} and module.exports access
		// inside the module itself. imported module is always "exports"
		const cjsExports = new Proxy(exportsObject, {
			get: (target, p, receiver) => {
				if (Reflect.has(target, p)) return Reflect.get(target, p, receiver);
				return Reflect.get(Object.prototype, p, receiver);
			},
			getPrototypeOf: () => Object.prototype,
			set: (_, p, value) => {
				// treat "module.exports =" the same as "exports.default =" to not have nested "default.default",
				// so "exports.default" becomes the actual module
				if (p === "default" && this.shouldInterop(module.file, { default: value }) && cjsExports !== value) {
					exportAll(cjsExports, value);
					exportsObject.default = value;
					return true;
				}
				if (!Reflect.has(exportsObject, "default")) exportsObject.default = {};
				// returns undefined, when accessing named exports, if default is not an object
				// but is still present inside hasOwnKeys, this is Node behaviour for CJS
				if (moduleExports !== SYMBOL_NOT_DEFINED && isPrimitive(moduleExports)) {
					defineExport(exportsObject, p, () => void 0);
					return true;
				}
				if (!isPrimitive(exportsObject.default)) exportsObject.default[p] = value;
				if (p !== "default") defineExport(exportsObject, p, () => value);
				return true;
			}
		});
		const moduleProxy = {
			set exports(value) {
				exportAll(cjsExports, value);
				exportsObject.default = value;
				moduleExports = value;
			},
			get exports() {
				return cjsExports;
			}
		};
		const meta = context[ssrImportMetaKey];
		if (this.options.getCurrentTestFilepath?.() === module.file) {
			const globalNamespace = this.vm?.context || globalThis;
			Object.defineProperty(meta, "vitest", { get: () => globalNamespace.__vitest_index__ });
		}
		const filename = meta.filename;
		const dirname = meta.dirname;
		const require = this.createRequire(filename);
		const argumentsList = [
			ssrModuleExportsKey,
			ssrImportMetaKey,
			ssrImportKey,
			ssrDynamicImportKey,
			ssrExportAllKey,
			"__vite_ssr_exportName__",
			"__filename",
			"__dirname",
			"module",
			"exports",
			"require"
		];
		if (this.compiledFunctionArgumentsNames) argumentsList.push(...this.compiledFunctionArgumentsNames);
		// add 'use strict' since ESM enables it by default
		const codeDefinition = `'use strict';async (${argumentsList.join(",")})=>{{`;
		const wrappedCode = `${codeDefinition}${code}\n}}`;
		const options = {
			filename: module.id,
			lineOffset: 0,
			columnOffset: -codeDefinition.length
		};
		const finishModuleExecutionInfo = this.debug.startCalculateModuleExecutionInfo(options.filename, codeDefinition.length);
		try {
			const initModule = this.vm ? vm.runInContext(wrappedCode, this.vm.context, options) : vm.runInThisContext(wrappedCode, options);
			const dynamicRequest = async (dep, options) => {
				dep = String(dep);
				// TODO: support more edge cases?
				// vite doesn't support dynamic modules by design, but we have to
				if (dep[0] === "#") return context[ssrDynamicImportKey](wrapId(dep), options);
				return context[ssrDynamicImportKey](dep, options);
			};
			await initModule(
				context[ssrModuleExportsKey],
				context[ssrImportMetaKey],
				context[ssrImportKey],
				dynamicRequest,
				context[ssrExportAllKey],
				// vite 7 support, remove when vite 7+ is supported
				context.__vite_ssr_exportName__ || ((name, getter) => Object.defineProperty(exportsObject, name, {
					enumerable: true,
					configurable: true,
					get: getter
				})),
				filename,
				dirname,
				moduleProxy,
				cjsExports,
				require,
				...this.compiledFunctionArgumentsValues
			);
		} finally {
			// moduleExecutionInfo needs to use Node filename instead of the normalized one
			// because we rely on this behaviour in coverage-v8, for example
			this.options.moduleExecutionInfo?.set(options.filename, finishModuleExecutionInfo());
		}
	}
	createRequire(filename) {
		// \x00 is a rollup convention for virtual files,
		// it is not allowed in actual file names
		if (filename[0] === "\0" || !isAbsolute(filename)) return () => ({});
		return this.vm ? this.vm.externalModulesExecutor.createRequire(filename) : createRequire(filename);
	}
	shouldInterop(path, mod) {
		if (this.options.interopDefault === false) return false;
		// never interop ESM modules
		// TODO: should also skip for `.js` with `type="module"`
		return !path.endsWith(".mjs") && "default" in mod;
	}
}
function createImportMetaEnvProxy() {
	// packages/vitest/src/node/plugins/index.ts:146
	const booleanKeys = [
		"DEV",
		"PROD",
		"SSR"
	];
	return new Proxy(process.env, {
		get(_, key) {
			if (typeof key !== "string") return;
			if (booleanKeys.includes(key)) return !!process.env[key];
			return process.env[key];
		},
		set(_, key, value) {
			if (typeof key !== "string") return true;
			if (booleanKeys.includes(key)) process.env[key] = value ? "1" : "";
			else process.env[key] = value;
			return true;
		}
	});
}
function updateStyle(id, css) {
	if (typeof document === "undefined") return;
	const element = document.querySelector(`[data-vite-dev-id="${id}"]`);
	if (element) {
		element.textContent = css;
		return;
	}
	const head = document.querySelector("head");
	const style = document.createElement("style");
	style.setAttribute("type", "text/css");
	style.setAttribute("data-vite-dev-id", id);
	style.textContent = css;
	head?.appendChild(style);
}
function removeStyle(id) {
	if (typeof document === "undefined") return;
	const sheet = document.querySelector(`[data-vite-dev-id="${id}"]`);
	if (sheet) document.head.removeChild(sheet);
}
const defaultClientStub = {
	injectQuery: (id) => id,
	createHotContext: () => {
		return {
			accept: () => {},
			prune: () => {},
			dispose: () => {},
			decline: () => {},
			invalidate: () => {},
			on: () => {},
			send: () => {}
		};
	},
	updateStyle: () => {},
	removeStyle: () => {}
};
function getDefaultRequestStubs(context) {
	if (!context) {
		const clientStub = {
			...defaultClientStub,
			updateStyle,
			removeStyle
		};
		return { "/@vite/client": clientStub };
	}
	const clientStub = vm.runInContext(`(defaultClient) => ({ ...defaultClient, updateStyle: ${updateStyle.toString()}, removeStyle: ${removeStyle.toString()} })`, context)(defaultClientStub);
	return { "/@vite/client": clientStub };
}
function exportAll(exports, sourceModule) {
	// #1120 when a module exports itself it causes
	// call stack error
	if (exports === sourceModule) return;
	if (isPrimitive(sourceModule) || Array.isArray(sourceModule) || sourceModule instanceof Promise) return;
	for (const key in sourceModule) if (key !== "default" && !(key in exports)) try {
		defineExport(exports, key, () => sourceModule[key]);
	} catch {}
}
// keep consistency with Vite on how exports are defined
function defineExport(exports, key, value) {
	Object.defineProperty(exports, key, {
		enumerable: true,
		configurable: true,
		get: value
	});
}
function isPrimitive(v) {
	return !(typeof v === "object" || typeof v === "function") || v == null;
}
function interopModule(mod) {
	if (isPrimitive(mod)) return {
		mod: { default: mod },
		defaultExport: mod
	};
	let defaultExport = "default" in mod ? mod.default : mod;
	if (!isPrimitive(defaultExport) && "__esModule" in defaultExport) {
		mod = defaultExport;
		if ("default" in defaultExport) defaultExport = defaultExport.default;
	}
	return {
		mod,
		defaultExport
	};
}
const VALID_ID_PREFIX = `/@id/`;
const NULL_BYTE_PLACEHOLDER = `__x00__`;
function wrapId(id) {
	return id.startsWith(VALID_ID_PREFIX) ? id : VALID_ID_PREFIX + id.replace("\0", NULL_BYTE_PLACEHOLDER);
}
function unwrapId(id) {
	return id.startsWith(VALID_ID_PREFIX) ? id.slice(VALID_ID_PREFIX.length).replace(NULL_BYTE_PLACEHOLDER, "\0") : id;
}

export { VitestModuleEvaluator, createImportMetaEnvProxy, getDefaultRequestStubs, isPrimitive, unwrapId, wrapId };
