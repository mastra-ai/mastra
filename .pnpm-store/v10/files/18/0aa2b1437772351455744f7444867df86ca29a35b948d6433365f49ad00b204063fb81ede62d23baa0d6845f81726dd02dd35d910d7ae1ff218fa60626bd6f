'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
const path__default = /*#__PURE__*/_interopDefaultCompat(path);

const defaultPropFilter = (prop) => {
  return !prop.parent?.fileName.includes("node_modules");
};

const getDocgen = async (config) => {
  const docGen = await import('react-docgen-typescript');
  const {
    tsconfigPath,
    compilerOptions,
    propFilter = defaultPropFilter,
    setDisplayName,
    typePropName,
    EXPERIMENTAL_useWatchProgram,
    ...rest
  } = config;
  const docgenOptions = {
    propFilter,
    ...rest
  };
  return docGen.withCompilerOptions(
    // Compiler Options are passed in to the custom program.
    {},
    docgenOptions
  );
};
const getCompilerOptions = async (config, tsconfigPath) => {
  const { default: ts } = await import('typescript');
  const { getTSConfigFile } = await import('./chunks/typescript.cjs');
  let compilerOptions = {
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.Latest
  };
  if (config.compilerOptions) {
    compilerOptions = {
      ...compilerOptions,
      ...config.compilerOptions
    };
  } else {
    const { options: tsOptions } = getTSConfigFile(tsconfigPath);
    compilerOptions = { ...compilerOptions, ...tsOptions };
  }
  return compilerOptions;
};
const createProgram = async (compilerOptions, includeArray) => {
  const { default: ts } = await import('typescript');
  const { globSync } = await import('glob');
  const files = includeArray.map(
    (filePath) => globSync(
      path__default.isAbsolute(filePath) ? filePath : path__default.posix.join(process.cwd(), filePath)
    )
  ).reduce((carry, files2) => carry.concat(files2), []);
  return ts.createProgram(files, compilerOptions);
};
const doNothing = () => {
};
const createStubFileWatcher = () => ({
  close: doNothing
});
const createProjectService = async () => {
  const { default: tsserver } = await import('typescript/lib/tsserverlibrary.js');
  const system = {
    ...tsserver.sys,
    clearImmediate,
    clearTimeout,
    setImmediate,
    setTimeout,
    watchDirectory: createStubFileWatcher,
    watchFile: createStubFileWatcher
  };
  return new tsserver.server.ProjectService({
    cancellationToken: { isCancellationRequested: () => false },
    host: system,
    jsDocParsingMode: 0,
    logger: {
      close: doNothing,
      endGroup: doNothing,
      getLogFileName: () => void 0,
      hasLevel: () => false,
      info: doNothing,
      loggingEnabled: () => false,
      msg: doNothing,
      perftrc: doNothing,
      startGroup: doNothing
    },
    session: void 0,
    useInferredProjectPerProjectRoot: false,
    useSingleInferredProject: false
  });
};
const startWatch = async (compilerOptions, tsconfigPath, onProgramCreatedOrUpdated) => {
  const { default: ts } = await import('typescript');
  const host = ts.createWatchCompilerHost(
    tsconfigPath,
    compilerOptions,
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    void 0,
    () => {
    }
  );
  host.afterProgramCreate = (program) => {
    onProgramCreatedOrUpdated(program.getProgram());
  };
  return new Promise((resolve) => {
    const watch = ts.createWatchProgram(host);
    resolve([watch.getProgram().getProgram(), watch.close]);
  });
};
function reactDocgenTypescript(config = {}) {
  let tsProgram;
  let docGenParser;
  let generateDocgenCodeBlock;
  let generateOptions;
  let filter;
  const moduleInvalidationQueue = /* @__PURE__ */ new Map();
  let closeWatch;
  let projectService = null;
  return {
    name: "vite:react-docgen-typescript",
    async configResolved() {
      const { getGenerateOptions } = await import('./chunks/options.cjs');
      generateDocgenCodeBlock = (await import('./chunks/generate.cjs')).generateDocgenCodeBlock;
      const { createFilter } = await import('vite');
      docGenParser = await getDocgen(config);
      generateOptions = getGenerateOptions(config);
      const tsconfigPath = config.tsconfigPath ?? "./tsconfig.json";
      const compilerOptions = await getCompilerOptions(config, tsconfigPath);
      const includeArray = config.include ?? ["**/**.tsx"];
      filter = createFilter(
        includeArray,
        config.exclude ?? ["**/**.stories.tsx"]
      );
      if (config.EXPERIMENTAL_useProjectService) {
        projectService = await createProjectService();
        return;
      }
      if (config.EXPERIMENTAL_useWatchProgram) {
        [tsProgram, closeWatch] = await startWatch(
          compilerOptions,
          tsconfigPath,
          (program) => {
            tsProgram = program;
            for (const [
              filepath,
              invalidateModule
            ] of moduleInvalidationQueue.entries()) {
              invalidateModule();
              moduleInvalidationQueue.delete(filepath);
            }
          }
        );
      } else {
        tsProgram = await createProgram(compilerOptions, includeArray);
      }
    },
    async transform(src, id) {
      if (!filter(id)) {
        return;
      }
      const source = await fs__default.readFile(id, "utf-8");
      try {
        const componentDocs = docGenParser.parseWithProgramProvider(id, () => {
          if (tsProgram) {
            return tsProgram;
          }
          projectService?.openClientFile(
            id,
            source,
            /* scriptKind */
            void 0,
            projectService?.currentDirectory
          );
          const scriptInfo = projectService?.getScriptInfo(id);
          if (scriptInfo?.fileName) {
            const languageServiceProgram = projectService?.getDefaultProjectForFile(scriptInfo?.fileName, true)?.getLanguageService(true).getProgram();
            if (languageServiceProgram) {
              return languageServiceProgram;
            }
          }
          throw new Error("Internal Error: No program available");
        });
        if (!componentDocs.length) {
          return null;
        }
        return generateDocgenCodeBlock({
          filename: id,
          source: src,
          componentDocs,
          ...generateOptions
        });
      } catch (e) {
        return src;
      }
    },
    async handleHotUpdate({ file, server, modules }) {
      if (!config.EXPERIMENTAL_useWatchProgram) return;
      if (!filter(file)) return;
      const module = modules.find((mod) => mod.file === file);
      if (!module) return;
      moduleInvalidationQueue.set(file, () => {
        server.moduleGraph.invalidateModule(
          module,
          void 0,
          Date.now(),
          true
        );
      });
    },
    closeBundle() {
      if (!config.EXPERIMENTAL_useWatchProgram) return;
      closeWatch();
    },
    buildEnd() {
      if (!config.EXPERIMENTAL_useWatchProgram) return;
      closeWatch();
    }
  };
}

module.exports = reactDocgenTypescript;
