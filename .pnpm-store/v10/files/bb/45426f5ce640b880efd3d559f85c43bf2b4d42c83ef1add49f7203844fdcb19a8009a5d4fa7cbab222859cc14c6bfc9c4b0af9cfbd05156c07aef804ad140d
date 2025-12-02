import { existsSync, promises } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mergeProcessCovs } from '@bcoe/v8-coverage';
import astV8ToIstanbul from 'ast-v8-to-istanbul';
import createDebug from 'debug';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import libSourceMaps from 'istanbul-lib-source-maps';
import reports from 'istanbul-reports';
import { parseModule } from 'magicast';
import { provider } from 'std-env';
import c from 'tinyrainbow';
import { BaseCoverageProvider } from 'vitest/coverage';
import { parseAstAsync } from 'vitest/node';
import { n as normalize } from './pathe.M-eThtNZ-BTaAGrLg.js';

var version = "4.0.12";

const FILE_PROTOCOL = "file://";
const debug = createDebug("vitest:coverage");
class V8CoverageProvider extends BaseCoverageProvider {
	name = "v8";
	version = version;
	initialize(ctx) {
		this._initialize(ctx);
	}
	createCoverageMap() {
		return libCoverage.createCoverageMap({});
	}
	async generateCoverage({ allTestsRun }) {
		const start = debug.enabled ? performance.now() : 0;
		const coverageMap = this.createCoverageMap();
		let merged = { result: [] };
		await this.readCoverageFiles({
			onFileRead(coverage) {
				merged = mergeProcessCovs([merged, coverage]);
				// mergeProcessCovs sometimes loses startOffset, e.g. in vue
				merged.result.forEach((result) => {
					if (!result.startOffset) {
						const original = coverage.result.find((r) => r.url === result.url);
						result.startOffset = original?.startOffset || 0;
					}
				});
			},
			onFinished: async (project, environment) => {
				const converted = await this.convertCoverage(merged, project, environment);
				// Source maps can change based on projectName and transform mode.
				// Coverage transform re-uses source maps so we need to separate transforms from each other.
				const transformedCoverage = await transformCoverage(converted);
				coverageMap.merge(transformedCoverage);
				merged = { result: [] };
			},
			onDebug: debug
		});
		// Include untested files when all tests were run (not a single file re-run)
		// or if previous results are preserved by "cleanOnRerun: false"
		if (this.options.include != null && (allTestsRun || !this.options.cleanOnRerun)) {
			const coveredFiles = coverageMap.files();
			const untestedCoverage = await this.getCoverageMapForUncoveredFiles(coveredFiles);
			coverageMap.merge(await transformCoverage(untestedCoverage));
		}
		coverageMap.filter((filename) => {
			const exists = existsSync(filename);
			if (this.options.excludeAfterRemap) {
				return exists && this.isIncluded(filename);
			}
			return exists;
		});
		if (debug.enabled) {
			debug(`Generate coverage total time ${(performance.now() - start).toFixed()} ms`);
		}
		return coverageMap;
	}
	async generateReports(coverageMap, allTestsRun) {
		if (provider === "stackblitz") {
			this.ctx.logger.log(c.blue(" % ") + c.yellow("@vitest/coverage-v8 does not work on Stackblitz. Report will be empty."));
		}
		const context = libReport.createContext({
			dir: this.options.reportsDirectory,
			coverageMap,
			watermarks: this.options.watermarks
		});
		if (this.hasTerminalReporter(this.options.reporter)) {
			this.ctx.logger.log(c.blue(" % ") + c.dim("Coverage report from ") + c.yellow(this.name));
		}
		for (const reporter of this.options.reporter) {
			// Type assertion required for custom reporters
			reports.create(reporter[0], {
				skipFull: this.options.skipFull,
				projectRoot: this.ctx.config.root,
				...reporter[1]
			}).execute(context);
		}
		if (this.options.thresholds) {
			await this.reportThresholds(coverageMap, allTestsRun);
		}
	}
	async parseConfigModule(configFilePath) {
		return parseModule(await promises.readFile(configFilePath, "utf8"));
	}
	async getCoverageMapForUncoveredFiles(testedFiles) {
		const transform = this.createUncoveredFileTransformer(this.ctx);
		const uncoveredFiles = await this.getUntestedFiles(testedFiles);
		let index = 0;
		const coverageMap = this.createCoverageMap();
		for (const chunk of this.toSlices(uncoveredFiles, this.options.processingConcurrency)) {
			if (debug.enabled) {
				index += chunk.length;
				debug("Uncovered files %d/%d", index, uncoveredFiles.length);
			}
			await Promise.all(chunk.map(async (filename) => {
				let timeout;
				let start;
				if (debug.enabled) {
					start = performance.now();
					timeout = setTimeout(() => debug(c.bgRed(`File "${filename}" is taking longer than 3s`)), 3e3);
				}
				// Do not use pathToFileURL to avoid encoding filename parts
				const url = `file://${filename[0] === "/" ? "" : "/"}${filename}`;
				const sources = await this.getSources(url, transform);
				coverageMap.merge(await this.remapCoverage(url, 0, sources, []));
				if (debug.enabled) {
					clearTimeout(timeout);
					const diff = performance.now() - start;
					const color = diff > 500 ? c.bgRed : c.bgGreen;
					debug(`${color(` ${diff.toFixed()} ms `)} ${filename}`);
				}
			}));
		}
		return coverageMap;
	}
	async remapCoverage(filename, wrapperLength, result, functions) {
		let ast;
		try {
			ast = await parseAstAsync(result.code);
		} catch (error) {
			this.ctx.logger.error(`Failed to parse ${filename}. Excluding it from coverage.\n`, error);
			return {};
		}
		return await astV8ToIstanbul({
			code: result.code,
			sourceMap: result.map,
			ast,
			coverage: {
				functions,
				url: filename
			},
			ignoreClassMethods: this.options.ignoreClassMethods,
			wrapperLength,
			ignoreNode: (node, type) => {
				// SSR transformed imports
				if (type === "statement" && node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.id.name.startsWith("__vite_ssr_import_")) {
					return true;
				}
				// SSR transformed exports vite@>6.3.5
				if (type === "statement" && node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression" && node.expression.left.type === "MemberExpression" && node.expression.left.object.type === "Identifier" && node.expression.left.object.name === "__vite_ssr_exports__") {
					return true;
				}
				// SSR transformed exports vite@^6.3.5
				if (type === "statement" && node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.id.name === "__vite_ssr_export_default__") {
					return true;
				}
				// CJS imports as ternaries - e.g.
				// const React = __vite__cjsImport0_react.__esModule ? __vite__cjsImport0_react.default : __vite__cjsImport0_react;
				if (type === "branch" && node.type === "ConditionalExpression" && node.test.type === "MemberExpression" && node.test.object.type === "Identifier" && node.test.object.name.startsWith("__vite__cjsImport") && node.test.property.type === "Identifier" && node.test.property.name === "__esModule") {
					return true;
				}
				// in-source test with "if (import.meta.vitest)"
				if ((type === "branch" || type === "statement") && node.type === "IfStatement" && node.test.type === "MemberExpression" && node.test.property.type === "Identifier" && node.test.property.name === "vitest") {
					// SSR
					if (node.test.object.type === "Identifier" && node.test.object.name === "__vite_ssr_import_meta__") {
						return "ignore-this-and-nested-nodes";
					}
					// Web
					if (node.test.object.type === "MetaProperty" && node.test.object.meta.name === "import" && node.test.object.property.name === "meta") {
						return "ignore-this-and-nested-nodes";
					}
				}
				// Browser mode's "import.meta.env ="
				if (type === "statement" && node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression" && node.expression.left.type === "MemberExpression" && node.expression.left.object.type === "MetaProperty" && node.expression.left.object.meta.name === "import" && node.expression.left.object.property.name === "meta" && node.expression.left.property.type === "Identifier" && node.expression.left.property.name === "env") {
					return true;
				}
				// SSR mode's "import.meta.env ="
				if (type === "statement" && node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression" && node.expression.left.type === "MemberExpression" && node.expression.left.object.type === "Identifier" && node.expression.left.object.name === "__vite_ssr_import_meta__") {
					return true;
				}
				// SWC's decorators
				if (type === "statement" && node.type === "ExpressionStatement" && node.expression.type === "CallExpression" && node.expression.callee.type === "Identifier" && node.expression.callee.name === "_ts_decorate") {
					return "ignore-this-and-nested-nodes";
				}
			}
		});
	}
	async getSources(url, onTransform, functions = []) {
		const transformResult = await onTransform(removeStartsWith(url, FILE_PROTOCOL)).catch(() => undefined);
		const map = transformResult?.map;
		const code = transformResult?.code;
		if (code == null) {
			const filePath = normalize(fileURLToPath(url));
			const original = await promises.readFile(filePath, "utf-8").catch(() => {
				// If file does not exist construct a dummy source for it.
				// These can be files that were generated dynamically during the test run and were removed after it.
				const length = findLongestFunctionLength(functions);
				return "/".repeat(length);
			});
			return { code: original };
		}
		// Vue needs special handling for "map.sources"
		if (map) {
			map.sources ||= [];
			map.sources = map.sources.filter((source) => source != null).map((source) => new URL(source, url).href);
			if (map.sources.length === 0) {
				map.sources.push(url);
			}
		}
		return {
			code,
			map
		};
	}
	async convertCoverage(coverage, project = this.ctx.getRootProject(), environment) {
		if (environment === "__browser__" && !project.browser) {
			throw new Error(`Cannot access browser module graph because it was torn down.`);
		}
		async function onTransform(filepath) {
			if (environment === "__browser__" && project.browser) {
				const result = await project.browser.vite.transformRequest(removeStartsWith(filepath, project.config.root));
				if (result) {
					return {
						...result,
						code: `${result.code}// <inline-source-map>`
					};
				}
			}
			return project.vite.environments[environment].transformRequest(filepath);
		}
		const scriptCoverages = [];
		for (const result of coverage.result) {
			if (environment === "__browser__") {
				if (result.url.startsWith("/@fs")) {
					result.url = `${FILE_PROTOCOL}${removeStartsWith(result.url, "/@fs")}`;
				} else if (result.url.startsWith(project.config.root)) {
					result.url = `${FILE_PROTOCOL}${result.url}`;
				} else {
					result.url = `${FILE_PROTOCOL}${project.config.root}${result.url}`;
				}
			}
			if (this.isIncluded(fileURLToPath(result.url))) {
				scriptCoverages.push({
					...result,
					url: decodeURIComponent(result.url)
				});
			}
		}
		const coverageMap = this.createCoverageMap();
		let index = 0;
		for (const chunk of this.toSlices(scriptCoverages, this.options.processingConcurrency)) {
			if (debug.enabled) {
				index += chunk.length;
				debug("Converting %d/%d", index, scriptCoverages.length);
			}
			await Promise.all(chunk.map(async ({ url, functions, startOffset }) => {
				let timeout;
				let start;
				if (debug.enabled) {
					start = performance.now();
					timeout = setTimeout(() => debug(c.bgRed(`File "${fileURLToPath(url)}" is taking longer than 3s`)), 3e3);
				}
				const sources = await this.getSources(url, onTransform, functions);
				coverageMap.merge(await this.remapCoverage(url, startOffset, sources, functions));
				if (debug.enabled) {
					clearTimeout(timeout);
					const diff = performance.now() - start;
					const color = diff > 500 ? c.bgRed : c.bgGreen;
					debug(`${color(` ${diff.toFixed()} ms `)} ${fileURLToPath(url)}`);
				}
			}));
		}
		return coverageMap;
	}
}
async function transformCoverage(coverageMap) {
	const sourceMapStore = libSourceMaps.createSourceMapStore();
	return await sourceMapStore.transformCoverage(coverageMap);
}
/**
* Find the function with highest `endOffset` to determine the length of the file
*/
function findLongestFunctionLength(functions) {
	return functions.reduce((previous, current) => {
		const maxEndOffset = current.ranges.reduce((endOffset, range) => Math.max(endOffset, range.endOffset), 0);
		return Math.max(previous, maxEndOffset);
	}, 0);
}
function removeStartsWith(filepath, start) {
	if (filepath.startsWith(start)) {
		return filepath.slice(start.length);
	}
	return filepath;
}

export { V8CoverageProvider };
