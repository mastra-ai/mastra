'use strict';

var mri = require('mri');
var errors = require('@changesets/errors');
var logger = require('@changesets/logger');
var util = require('util');
var config = require('@changesets/config');
var getDependentsGraph = require('@changesets/get-dependents-graph');
var shouldSkipPackage = require('@changesets/should-skip-package');
var getPackages = require('@manypkg/get-packages');
var fs = require('fs-extra');
var path = require('path');
var pc = require('picocolors');
var child_process = require('child_process');
var git = require('@changesets/git');
var writeChangeset = require('@changesets/write');
var externalEditor = require('@inquirer/external-editor');
var resolveFrom = require('resolve-from');
var termSize = require('term-size');
var enquirer = require('enquirer');
var ansiColors = require('ansi-colors');
var semverLt = require('semver/functions/lt');
var pre$1 = require('@changesets/pre');
var semverParse = require('semver/functions/parse');
var pLimit = require('p-limit');
var packageManagerDetector = require('package-manager-detector');
var spawn = require('spawndamnit');
var ciInfo = require('ci-info');
var getReleasePlan = require('@changesets/get-release-plan');
var applyReleasePlan = require('@changesets/apply-release-plan');
var readChangesets = require('@changesets/read');
var assembleReleasePlan = require('@changesets/assemble-release-plan');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var mri__default = /*#__PURE__*/_interopDefault(mri);
var logger__namespace = /*#__PURE__*/_interopNamespace(logger);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);
var pc__default = /*#__PURE__*/_interopDefault(pc);
var git__namespace = /*#__PURE__*/_interopNamespace(git);
var writeChangeset__default = /*#__PURE__*/_interopDefault(writeChangeset);
var resolveFrom__default = /*#__PURE__*/_interopDefault(resolveFrom);
var termSize__default = /*#__PURE__*/_interopDefault(termSize);
var semverLt__default = /*#__PURE__*/_interopDefault(semverLt);
var semverParse__default = /*#__PURE__*/_interopDefault(semverParse);
var pLimit__default = /*#__PURE__*/_interopDefault(pLimit);
var spawn__default = /*#__PURE__*/_interopDefault(spawn);
var getReleasePlan__default = /*#__PURE__*/_interopDefault(getReleasePlan);
var applyReleasePlan__default = /*#__PURE__*/_interopDefault(applyReleasePlan);
var readChangesets__default = /*#__PURE__*/_interopDefault(readChangesets);
var assembleReleasePlan__default = /*#__PURE__*/_interopDefault(assembleReleasePlan);

function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}

function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}

function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[r] = t, e;
}

function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}

function getCommitFunctions(commit, cwd) {
  let commitFunctions = {};
  if (!commit) {
    return [commitFunctions, null];
  }
  let commitOpts = commit[1];
  let changesetPath = path__default["default"].join(cwd, ".changeset");
  let commitPath = resolveFrom__default["default"](changesetPath, commit[0]);
  let possibleCommitFunc = require(commitPath);
  if (possibleCommitFunc.default) {
    possibleCommitFunc = possibleCommitFunc.default;
  }
  if (typeof possibleCommitFunc.getAddMessage === "function" || typeof possibleCommitFunc.getVersionMessage === "function") {
    commitFunctions = possibleCommitFunc;
  } else {
    throw new Error("Could not resolve commit generation functions");
  }
  return [commitFunctions, commitOpts];
}

// @ts-ignore it's not worth writing a TS declaration file in this repo for a tiny module we use once like this

// those types are not exported from `enquirer` so we extract them here
// so we can make type assertions using them because `enquirer` types do no support `prefix` right now

/* Notes on using inquirer:
 * Each question needs a key, as inquirer is assembling an object behind-the-scenes.
 * At each call, the entire responses object is returned, so we need a unique
 * identifier for the name every time. This is why we are using serial IDs
 */
const serialId = function () {
  let id = 0;
  return () => id++;
}();
const limit = Math.max(termSize__default["default"]().rows - 5, 10);
let cancelFlow = () => {
  logger.success("Cancelled... 👋 ");
  process.exit();
};
async function askCheckboxPlus(message, choices, format) {
  const name = `CheckboxPlus-${serialId()}`;
  return enquirer.prompt({
    type: "autocomplete",
    name,
    message,
    prefix: logger.prefix,
    multiple: true,
    choices,
    format,
    limit,
    onCancel: cancelFlow,
    symbols: {
      indicator: ansiColors.symbols.radioOff,
      checked: ansiColors.symbols.radioOn
    },
    indicator(state, choice) {
      return choice.enabled ? state.symbols.checked : state.symbols.indicator;
    }
  }).then(responses => responses[name]).catch(err => {
    logger.error(err);
  });
}
async function askQuestion(message) {
  const name = `Question-${serialId()}`;
  return enquirer.prompt([{
    type: "input",
    message,
    name,
    prefix: logger.prefix,
    onCancel: cancelFlow
  }]).then(responses => responses[name]).catch(err => {
    logger.error(err);
  });
}
function askQuestionWithEditor(message) {
  const response = externalEditor.edit(message, {
    postfix: ".md"
  });
  return response.replace(/^#.*\n?/gm, "").replace(/\n+$/g, "").trim();
}
async function askConfirm(message) {
  const name = `Confirm-${serialId()}`;
  return enquirer.prompt([{
    message,
    name,
    prefix: logger.prefix,
    type: "confirm",
    initial: true,
    onCancel: cancelFlow
  }]).then(responses => responses[name]).catch(err => {
    logger.error(err);
  });
}
async function askList(message, choices) {
  const name = `List-${serialId()}`;
  return enquirer.prompt([{
    choices,
    message,
    name,
    prefix: logger.prefix,
    type: "select",
    onCancel: cancelFlow
  }]).then(responses => responses[name]).catch(err => {
    logger.error(err);
  });
}

async function getVersionableChangedPackages(config, {
  cwd,
  ref
}) {
  const changedPackages = await git.getChangedPackagesSinceRef({
    ref: ref !== null && ref !== void 0 ? ref : config.baseBranch,
    changedFilePatterns: config.changedFilePatterns,
    cwd
  });
  return changedPackages.filter(pkg => !shouldSkipPackage.shouldSkipPackage(pkg, {
    ignore: config.ignore,
    allowPrivatePackages: config.privatePackages.version
  }));
}

const {
  green,
  yellow,
  red,
  bold,
  blue,
  cyan,
  gray
} = pc__default["default"];
async function confirmMajorRelease(pkgJSON) {
  if (semverLt__default["default"](pkgJSON.version, "1.0.0")) {
    // prettier-ignore
    logger.log(yellow(`WARNING: Releasing a major version for ${green(pkgJSON.name)} will be its ${red('first major release')}.`));
    logger.log(yellow(`If you are unsure if this is correct, contact the package's maintainers ${red("before committing this changeset")}.`));
    let shouldReleaseFirstMajor = await askConfirm(bold(`Are you sure you want to release the ${red("first major version")} of ${pkgJSON.name}?`));
    return shouldReleaseFirstMajor;
  }
  return true;
}
async function getPackagesToRelease(changedPackages, allPackages) {
  function askInitialReleaseQuestion(defaultChoiceList) {
    return askCheckboxPlus(
    // TODO: Make this wording better
    // TODO: take objects and be fancy with matching
    `Which packages would you like to include?`, defaultChoiceList, x => {
      // this removes changed packages and unchanged packages from the list
      // of packages shown after selection
      if (Array.isArray(x)) {
        return x.filter(x => x !== "changed packages" && x !== "unchanged packages").map(x => cyan(x)).join(", ");
      }
      return x;
    });
  }
  if (allPackages.length > 1) {
    const unchangedPackagesNames = allPackages.map(({
      packageJson
    }) => packageJson.name).filter(name => !changedPackages.includes(name));
    const defaultChoiceList = [{
      name: "changed packages",
      choices: changedPackages
    }, {
      name: "unchanged packages",
      choices: unchangedPackagesNames
    }].filter(({
      choices
    }) => choices.length !== 0);
    let packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);
    if (packagesToRelease.length === 0) {
      do {
        logger.error("You must select at least one package to release");
        logger.error("(You most likely hit enter instead of space!)");
        packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);
      } while (packagesToRelease.length === 0);
    }
    return packagesToRelease.filter(pkgName => pkgName !== "changed packages" && pkgName !== "unchanged packages");
  }
  return [allPackages[0].packageJson.name];
}
function getPkgJsonsByName(packages) {
  return new Map(packages.map(({
    packageJson
  }) => [packageJson.name, packageJson]));
}
function formatPkgNameAndVersion(pkgName, version) {
  return `${bold(pkgName)}@${bold(version)}`;
}
async function createChangeset(changedPackages, allPackages) {
  const releases = [];
  if (allPackages.length > 1) {
    const packagesToRelease = await getPackagesToRelease(changedPackages, allPackages);
    let pkgJsonsByName = getPkgJsonsByName(allPackages);
    let pkgsLeftToGetBumpTypeFor = new Set(packagesToRelease);
    let pkgsThatShouldBeMajorBumped = (await askCheckboxPlus(bold(`Which packages should have a ${red("major")} bump?`), [{
      name: "all packages",
      choices: packagesToRelease.map(pkgName => {
        return {
          name: pkgName,
          message: formatPkgNameAndVersion(pkgName, pkgJsonsByName.get(pkgName).version)
        };
      })
    }], x => {
      // this removes changed packages and unchanged packages from the list
      // of packages shown after selection
      if (Array.isArray(x)) {
        return x.filter(x => x !== "all packages").map(x => cyan(x)).join(", ");
      }
      return x;
    })).filter(x => x !== "all packages");
    for (const pkgName of pkgsThatShouldBeMajorBumped) {
      // for packages that are under v1, we want to make sure major releases are intended,
      // as some repo-wide sweeping changes have mistakenly release first majors
      // of packages.
      let pkgJson = pkgJsonsByName.get(pkgName);
      let shouldReleaseFirstMajor = await confirmMajorRelease(pkgJson);
      if (shouldReleaseFirstMajor) {
        pkgsLeftToGetBumpTypeFor.delete(pkgName);
        releases.push({
          name: pkgName,
          type: "major"
        });
      }
    }
    if (pkgsLeftToGetBumpTypeFor.size !== 0) {
      let pkgsThatShouldBeMinorBumped = (await askCheckboxPlus(bold(`Which packages should have a ${green("minor")} bump?`), [{
        name: "all packages",
        choices: [...pkgsLeftToGetBumpTypeFor].map(pkgName => {
          return {
            name: pkgName,
            message: formatPkgNameAndVersion(pkgName, pkgJsonsByName.get(pkgName).version)
          };
        })
      }], x => {
        // this removes changed packages and unchanged packages from the list
        // of packages shown after selection
        if (Array.isArray(x)) {
          return x.filter(x => x !== "all packages").map(x => cyan(x)).join(", ");
        }
        return x;
      })).filter(x => x !== "all packages");
      for (const pkgName of pkgsThatShouldBeMinorBumped) {
        pkgsLeftToGetBumpTypeFor.delete(pkgName);
        releases.push({
          name: pkgName,
          type: "minor"
        });
      }
    }
    if (pkgsLeftToGetBumpTypeFor.size !== 0) {
      logger.log(`The following packages will be ${blue("patch")} bumped:`);
      pkgsLeftToGetBumpTypeFor.forEach(pkgName => {
        logger.log(formatPkgNameAndVersion(pkgName, pkgJsonsByName.get(pkgName).version));
      });
      for (const pkgName of pkgsLeftToGetBumpTypeFor) {
        releases.push({
          name: pkgName,
          type: "patch"
        });
      }
    }
  } else {
    let pkg = allPackages[0];
    let type = await askList(`What kind of change is this for ${green(pkg.packageJson.name)}? (current version is ${pkg.packageJson.version})`, ["patch", "minor", "major"]);
    if (type === "major") {
      let shouldReleaseAsMajor = await confirmMajorRelease(pkg.packageJson);
      if (!shouldReleaseAsMajor) {
        throw new errors.ExitError(1);
      }
    }
    releases.push({
      name: pkg.packageJson.name,
      type
    });
  }
  logger.log("Please enter a summary for this change (this will be in the changelogs).");
  logger.log(gray("  (submit empty line to open external editor)"));
  let summary = await askQuestion("Summary");
  if (summary.length === 0) {
    try {
      summary = askQuestionWithEditor("\n\n# Please enter a summary for your changes.\n# An empty message aborts the editor.");
      if (summary.length > 0) {
        return {
          confirmed: true,
          summary,
          releases
        };
      }
    } catch (err) {
      logger.log("An error happened using external editor. Please type your summary here:");
    }
    summary = await askQuestion("");
    while (summary.length === 0) {
      summary = await askQuestion("\n\n# A summary is required for the changelog! 😪");
    }
  }
  return {
    confirmed: false,
    summary,
    releases
  };
}

function printConfirmationMessage(changeset, repoHasMultiplePackages) {
  function getReleasesOfType(type) {
    return changeset.releases.filter(release => release.type === type).map(release => release.name);
  }
  logger.log("\n=== Summary of changesets ===");
  const majorReleases = getReleasesOfType("major");
  const minorReleases = getReleasesOfType("minor");
  const patchReleases = getReleasesOfType("patch");
  if (majorReleases.length > 0) logger.log(`${pc__default["default"].bold(pc__default["default"].green("major"))}:  ${majorReleases.join(", ")}`);
  if (minorReleases.length > 0) logger.log(`${pc__default["default"].bold(pc__default["default"].green("minor"))}:  ${minorReleases.join(", ")}`);
  if (patchReleases.length > 0) logger.log(`${pc__default["default"].bold(pc__default["default"].green("patch"))}:  ${patchReleases.join(", ")}`);
  logger.log("");
  if (repoHasMultiplePackages) {
    const message = "Note: All dependents of these packages that will be incompatible with the new version will be " + pc__default["default"].redBright("patch bumped") + " when this changeset is applied.";
    logger.log(message + "\n");
  }
}

async function add(cwd, {
  empty,
  open
}, config) {
  const packages = await getPackages.getPackages(cwd);
  if (packages.packages.length === 0) {
    logger.error(`No packages found. You might have ${packages.tool} workspaces configured but no packages yet?`);
    throw new errors.ExitError(1);
  }
  const versionablePackages = packages.packages.filter(pkg => !shouldSkipPackage.shouldSkipPackage(pkg, {
    ignore: config.ignore,
    allowPrivatePackages: config.privatePackages.version
  }));
  if (versionablePackages.length === 0) {
    logger.error("No versionable packages found");
    logger.error('- Ensure the packages to version are not in the "ignore" config');
    logger.error('- Ensure that relevant package.json files have the "version" field');
    throw new errors.ExitError(1);
  }
  const changesetBase = path__default["default"].resolve(cwd, ".changeset");
  let newChangeset;
  if (empty) {
    newChangeset = {
      confirmed: true,
      releases: [],
      summary: ``
    };
  } else {
    let changedPackagesNames = [];
    try {
      changedPackagesNames = (await getVersionableChangedPackages(config, {
        cwd
      })).map(pkg => pkg.packageJson.name);
    } catch (e) {
      // NOTE: Getting the changed packages is best effort as it's only being used for easier selection
      // in the CLI. So if any error happens while we try to do so, we only log a warning and continue
      logger.warn(`Failed to find changed packages from the "${config.baseBranch}" base branch due to error below`);
      logger.warn(e);
    }
    newChangeset = await createChangeset(changedPackagesNames, versionablePackages);
    printConfirmationMessage(newChangeset, versionablePackages.length > 1);
    if (!newChangeset.confirmed) {
      newChangeset = _objectSpread2(_objectSpread2({}, newChangeset), {}, {
        confirmed: await askConfirm("Is this your desired changeset?")
      });
    }
  }
  if (newChangeset.confirmed) {
    const changesetID = await writeChangeset__default["default"](newChangeset, cwd, config);
    const [{
      getAddMessage
    }, commitOpts] = getCommitFunctions(config.commit, cwd);
    if (getAddMessage) {
      await git__namespace.add(path__default["default"].resolve(changesetBase, `${changesetID}.md`), cwd);
      await git__namespace.commit(await getAddMessage(newChangeset, commitOpts), cwd);
      logger.log(pc__default["default"].green(`${empty ? "Empty " : ""}Changeset added and committed`));
    } else {
      logger.log(pc__default["default"].green(`${empty ? "Empty " : ""}Changeset added! - you can now commit it\n`));
    }
    let hasMajorChange = [...newChangeset.releases].find(c => c.type === "major");
    if (hasMajorChange) {
      logger.warn("This Changeset includes a major change and we STRONGLY recommend adding more information to the changeset:");
      logger.warn("WHAT the breaking change is");
      logger.warn("WHY the change was made");
      logger.warn("HOW a consumer should update their code");
    } else {
      logger.log(pc__default["default"].green("If you want to modify or expand on the changeset summary, you can find it here"));
    }
    const changesetPath = path__default["default"].resolve(changesetBase, `${changesetID}.md`);
    logger.info(pc__default["default"].blue(changesetPath));
    if (open) {
      // this is really a hack to reuse the logic embedded in `external-editor` related to determining the editor
      const externalEditor$1 = new externalEditor.ExternalEditor();
      externalEditor$1.cleanup();
      child_process.spawn(externalEditor$1.editor.bin, externalEditor$1.editor.args.concat([changesetPath]), {
        detached: true,
        stdio: "inherit"
      });
    }
  }
}

const pkgPath = path__default["default"].dirname(require.resolve("@changesets/cli/package.json"));

// Modify base branch to "main" without changing defaultWrittenConfig since it also serves as a fallback
// for config files that don't specify a base branch. Changing that to main would be a breaking change.
const defaultConfig = `${JSON.stringify(_objectSpread2(_objectSpread2({}, config.defaultWrittenConfig), {}, {
  baseBranch: "main"
}), null, 2)}\n`;
async function init(cwd) {
  const changesetBase = path__default["default"].resolve(cwd, ".changeset");
  if (fs__default["default"].existsSync(changesetBase)) {
    if (!fs__default["default"].existsSync(path__default["default"].join(changesetBase, "config.json"))) {
      if (fs__default["default"].existsSync(path__default["default"].join(changesetBase, "config.js"))) {
        logger.error("It looks like you're using the version 1 `.changeset/config.js` file");
        logger.error("The format of the config object has significantly changed in v2 as well");
        logger.error(" - we thoroughly recommend looking at the changelog for this package for what has changed");
        logger.error("Changesets will write the defaults for the new config, remember to transfer your options into the new config at `.changeset/config.json`");
      } else {
        logger.error("It looks like you don't have a config file");
        logger.info("The default config file will be written at `.changeset/config.json`");
      }
      await fs__default["default"].writeFile(path__default["default"].resolve(changesetBase, "config.json"), defaultConfig);
    } else {
      logger.warn("It looks like you already have changesets initialized. You should be able to run changeset commands no problems.");
    }
  } else {
    await fs__default["default"].copy(path__default["default"].resolve(pkgPath, "./default-files"), changesetBase);
    await fs__default["default"].writeFile(path__default["default"].resolve(changesetBase, "config.json"), defaultConfig);
    logger.log(`Thanks for choosing ${pc__default["default"].green("changesets")} to help manage your versioning and publishing\n`);
    logger.log("You should be set up to start using changesets now!\n");
    logger.info("We have added a `.changeset` folder, and a couple of files to help you out:");
    logger.info(`- ${pc__default["default"].blue(".changeset/README.md")} contains information about using changesets`);
    logger.info(`- ${pc__default["default"].blue(".changeset/config.json")} is our default config`);
  }
}

async function pre(cwd, options) {
  if (options.command === "enter") {
    try {
      await pre$1.enterPre(cwd, options.tag);
      logger__namespace.success(`Entered pre mode with tag ${pc__default["default"].cyan(options.tag)}`);
      logger__namespace.info("Run `changeset version` to version packages with prerelease versions");
    } catch (err) {
      if (err instanceof errors.PreEnterButInPreModeError) {
        logger__namespace.error("`changeset pre enter` cannot be run when in pre mode");
        logger__namespace.info("If you're trying to exit pre mode, run `changeset pre exit`");
        throw new errors.ExitError(1);
      }
      throw err;
    }
  } else {
    try {
      await pre$1.exitPre(cwd);
      logger__namespace.success(`Exited pre mode`);
      logger__namespace.info("Run `changeset version` to version packages with normal versions");
    } catch (err) {
      if (err instanceof errors.PreExitButNotInPreModeError) {
        logger__namespace.error("`changeset pre exit` can only be run when in pre mode");
        logger__namespace.info("If you're trying to enter pre mode, run `changeset pre enter`");
        throw new errors.ExitError(1);
      }
      throw err;
    }
  }
}

const getLastJsonObjectFromString = str => {
  str = str.replace(/[^}]*$/, "");
  while (str) {
    str = str.replace(/[^{]*/, "");
    try {
      return JSON.parse(str);
    } catch (err) {
      // move past the potentially leading `{` so the regexp in the loop can try to match for the next `{`
      str = str.slice(1);
    }
  }
  return null;
};

const npmRequestLimit = pLimit__default["default"](40);
const npmPublishLimit = pLimit__default["default"](10);
function jsonParse(input) {
  try {
    return JSON.parse(input);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("error parsing json:", input);
    }
    throw err;
  }
}
function getCorrectRegistry(packageJson) {
  var _packageJson$publishC;
  const packageName = packageJson === null || packageJson === void 0 ? void 0 : packageJson.name;
  if (packageName !== null && packageName !== void 0 && packageName.startsWith("@")) {
    var _publishConfig;
    const scope = packageName.split("/")[0];
    const scopedRegistry = ((_publishConfig = packageJson.publishConfig) === null || _publishConfig === void 0 ? void 0 : _publishConfig[`${scope}:registry`]) || process.env[`npm_config_${scope}:registry`];
    if (scopedRegistry) {
      return {
        scope,
        registry: scopedRegistry
      };
    }
  }
  const registry = (packageJson === null || packageJson === void 0 || (_packageJson$publishC = packageJson.publishConfig) === null || _packageJson$publishC === void 0 ? void 0 : _packageJson$publishC.registry) || process.env.npm_config_registry;
  return {
    scope: undefined,
    registry: !registry || registry === "https://registry.yarnpkg.com" ? "https://registry.npmjs.org" : registry
  };
}
async function getPublishTool(cwd) {
  const pm = await packageManagerDetector.detect({
    cwd
  });
  if (!pm || pm.name !== "pnpm") return {
    name: "npm"
  };
  try {
    let result = await spawn__default["default"]("pnpm", ["--version"], {
      cwd
    });
    let version = result.stdout.toString().trim();
    let parsed = semverParse__default["default"](version);
    return {
      name: "pnpm",
      shouldAddNoGitChecks: (parsed === null || parsed === void 0 ? void 0 : parsed.major) === undefined ? false : parsed.major >= 5
    };
  } catch (e) {
    return {
      name: "pnpm",
      shouldAddNoGitChecks: false
    };
  }
}
async function getTokenIsRequired() {
  const {
    scope,
    registry
  } = getCorrectRegistry();
  // Due to a super annoying issue in yarn, we have to manually override this env variable
  // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
  const envOverride = {
    [scope ? `npm_config_${scope}:registry` : "npm_config_registry"]: registry
  };
  let result = await spawn__default["default"]("npm", ["profile", "get", "--json"], {
    env: Object.assign({}, process.env, envOverride)
  });
  if (result.code !== 0) {
    logger.error("error while checking if token is required", result.stderr.toString().trim() || result.stdout.toString().trim());
    return false;
  }
  let json = jsonParse(result.stdout.toString());
  if (json.error || !json.tfa || !json.tfa.mode) {
    return false;
  }
  return json.tfa.mode === "auth-and-writes";
}
function getPackageInfo(packageJson) {
  return npmRequestLimit(async () => {
    logger.info(`npm info ${packageJson.name}`);
    const {
      scope,
      registry
    } = getCorrectRegistry(packageJson);

    // Due to a couple of issues with yarnpkg, we also want to override the npm registry when doing
    // npm info.
    // Issues: We sometimes get back cached responses, i.e old data about packages which causes
    // `publish` to behave incorrectly. It can also cause issues when publishing private packages
    // as they will always give a 404, which will tell `publish` to always try to publish.
    // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
    let result = await spawn__default["default"]("npm", ["info", packageJson.name, `--${scope ? `${scope}:` : ""}registry=${registry}`, "--json"]);

    // Github package registry returns empty string when calling npm info
    // for a non-existent package instead of a E404
    if (result.stdout.toString() === "") {
      return {
        error: {
          code: "E404"
        }
      };
    }
    return jsonParse(result.stdout.toString());
  });
}
async function infoAllow404(packageJson) {
  var _pkgInfo$error;
  let pkgInfo = await getPackageInfo(packageJson);
  if (((_pkgInfo$error = pkgInfo.error) === null || _pkgInfo$error === void 0 ? void 0 : _pkgInfo$error.code) === "E404") {
    logger.warn(`Received 404 for npm info ${pc__default["default"].cyan(`"${packageJson.name}"`)}`);
    return {
      published: false,
      pkgInfo: {}
    };
  }
  if (pkgInfo.error) {
    logger.error(`Received an unknown error code: ${pkgInfo.error.code} for npm info ${pc__default["default"].cyan(`"${packageJson.name}"`)}`);
    logger.error(pkgInfo.error.summary);
    if (pkgInfo.error.detail) logger.error(pkgInfo.error.detail);
    throw new errors.ExitError(1);
  }
  return {
    published: true,
    pkgInfo
  };
}
let otpAskLimit = pLimit__default["default"](1);
let askForOtpCode = twoFactorState => otpAskLimit(async () => {
  if (twoFactorState.token !== null) return twoFactorState.token;
  logger.info("This operation requires a one-time password from your authenticator.");
  let val = await askQuestion("Enter one-time password:");
  twoFactorState.token = val;
  return val;
});
let getOtpCode = async twoFactorState => {
  if (twoFactorState.token !== null) {
    return twoFactorState.token;
  }
  return askForOtpCode(twoFactorState);
};

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(packageJson, opts, twoFactorState) {
  let publishTool = await getPublishTool(opts.cwd);
  let publishFlags = opts.access ? ["--access", opts.access] : [];
  publishFlags.push("--tag", opts.tag);
  if ((await twoFactorState.isRequired) && !ciInfo.isCI) {
    let otpCode = await getOtpCode(twoFactorState);
    publishFlags.push("--otp", otpCode);
  }
  if (publishTool.name === "pnpm" && publishTool.shouldAddNoGitChecks) {
    publishFlags.push("--no-git-checks");
  }
  const {
    scope,
    registry
  } = getCorrectRegistry(packageJson);

  // Due to a super annoying issue in yarn, we have to manually override this env variable
  // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
  const envOverride = {
    [scope ? `npm_config_${scope}:registry` : "npm_config_registry"]: registry
  };
  let {
    code,
    stdout,
    stderr
  } = publishTool.name === "pnpm" ? await spawn__default["default"]("pnpm", ["publish", "--json", ...publishFlags], {
    env: Object.assign({}, process.env, envOverride),
    cwd: opts.cwd
  }) : await spawn__default["default"](publishTool.name, ["publish", opts.publishDir, "--json", ...publishFlags], {
    env: Object.assign({}, process.env, envOverride)
  });
  if (code !== 0) {
    // NPM's --json output is included alongside the `prepublish` and `postpublish` output in terminal
    // We want to handle this as best we can but it has some struggles:
    // - output of those lifecycle scripts can contain JSON
    // - npm7 has switched to printing `--json` errors to stderr (https://github.com/npm/cli/commit/1dbf0f9bb26ba70f4c6d0a807701d7652c31d7d4)
    // Note that the `--json` output is always printed at the end so this should work
    let json = getLastJsonObjectFromString(stderr.toString()) || getLastJsonObjectFromString(stdout.toString());
    if (json !== null && json !== void 0 && json.error) {
      // The first case is no 2fa provided, the second is when the 2fa is wrong (timeout or wrong words)
      if ((json.error.code === "EOTP" || json.error.code === "E401" && json.error.detail.includes("--otp=<code>")) && !ciInfo.isCI) {
        if (twoFactorState.token !== null) {
          // the current otp code must be invalid since it errored
          twoFactorState.token = null;
        }
        // just in case this isn't already true
        twoFactorState.isRequired = Promise.resolve(true);
        return internalPublish(packageJson, opts, twoFactorState);
      }
      logger.error(`an error occurred while publishing ${packageJson.name}: ${json.error.code}`, json.error.summary, json.error.detail ? "\n" + json.error.detail : "");
    }
    logger.error(stderr.toString() || stdout.toString());
    return {
      published: false
    };
  }
  return {
    published: true
  };
}
function publish$1(packageJson, opts, twoFactorState) {
  // If there are many packages to be published, it's better to limit the
  // concurrency to avoid unwanted errors, for example from npm.
  return npmRequestLimit(() => npmPublishLimit(() => internalPublish(packageJson, opts, twoFactorState)));
}

function getReleaseTag(pkgInfo, preState, tag) {
  if (tag) return tag;
  if (preState !== undefined && pkgInfo.publishedState !== "only-pre") {
    return preState.tag;
  }
  return "latest";
}
const isCustomRegistry = registry => !!registry && registry !== "https://registry.npmjs.org" && registry !== "https://registry.yarnpkg.com";
const getTwoFactorState = ({
  otp,
  publicPackages
}) => {
  if (otp) {
    return {
      token: otp,
      isRequired: Promise.resolve(true)
    };
  }
  if (ciInfo.isCI || publicPackages.some(pkg => isCustomRegistry(getCorrectRegistry(pkg.packageJson).registry)) || isCustomRegistry(process.env.npm_config_registry)) {
    return {
      token: null,
      isRequired: Promise.resolve(false)
    };
  }
  return {
    token: null,
    // note: we're not awaiting this here, we want this request to happen in parallel with getUnpublishedPackages
    isRequired: getTokenIsRequired()
  };
};
async function publishPackages({
  packages,
  access,
  otp,
  preState,
  tag
}) {
  const packagesByName = new Map(packages.map(x => [x.packageJson.name, x]));
  const publicPackages = packages.filter(pkg => !pkg.packageJson.private);
  const unpublishedPackagesInfo = await getUnpublishedPackages(publicPackages, preState);
  if (unpublishedPackagesInfo.length === 0) {
    return [];
  }
  const twoFactorState = getTwoFactorState({
    otp,
    publicPackages
  });
  return Promise.all(unpublishedPackagesInfo.map(pkgInfo => {
    let pkg = packagesByName.get(pkgInfo.name);
    return publishAPackage(pkg, access, twoFactorState, getReleaseTag(pkgInfo, preState, tag));
  }));
}
async function publishAPackage(pkg, access, twoFactorState, tag) {
  const {
    name,
    version,
    publishConfig
  } = pkg.packageJson;
  logger.info(`Publishing ${pc__default["default"].cyan(`"${name}"`)} at ${pc__default["default"].green(`"${version}"`)}`);
  const publishConfirmation = await publish$1(pkg.packageJson, {
    cwd: pkg.dir,
    publishDir: publishConfig !== null && publishConfig !== void 0 && publishConfig.directory ? path.resolve(pkg.dir, publishConfig.directory) : pkg.dir,
    access: (publishConfig === null || publishConfig === void 0 ? void 0 : publishConfig.access) || access,
    tag
  }, twoFactorState);
  return {
    name,
    newVersion: version,
    published: publishConfirmation.published
  };
}
async function getUnpublishedPackages(packages, preState) {
  const results = await Promise.all(packages.map(async ({
    packageJson
  }) => {
    const response = await infoAllow404(packageJson);
    let publishedState = "never";
    if (response.published) {
      publishedState = "published";
      if (preState !== undefined) {
        if (response.pkgInfo.versions && response.pkgInfo.versions.every(version => semverParse__default["default"](version).prerelease[0] === preState.tag)) {
          publishedState = "only-pre";
        }
      }
    }
    return {
      name: packageJson.name,
      localVersion: packageJson.version,
      publishedState,
      publishedVersions: response.pkgInfo.versions || []
    };
  }));
  const packagesToPublish = [];
  for (const pkgInfo of results) {
    const {
      name,
      publishedState,
      localVersion,
      publishedVersions
    } = pkgInfo;
    if (!publishedVersions.includes(localVersion)) {
      packagesToPublish.push(pkgInfo);
      logger.info(`${name} is being published because our local version (${localVersion}) has not been published on npm`);
      if (preState !== undefined && publishedState === "only-pre") {
        logger.info(`${name} is being published to ${pc__default["default"].cyan("latest")} rather than ${pc__default["default"].cyan(preState.tag)} because there has not been a regular release of it yet`);
      }
    } else {
      // If the local version is behind npm, something is wrong, we warn here, and by not getting published later, it will fail
      logger.warn(`${name} is not being published because version ${localVersion} is already published on npm`);
    }
  }
  return packagesToPublish;
}

async function getUntaggedPackages(packages, cwd, tool) {
  const packageWithTags = await Promise.all(packages.map(async pkg => {
    const tagName = tool === "root" ? `v${pkg.packageJson.version}` : `${pkg.packageJson.name}@${pkg.packageJson.version}`;
    const isMissingTag = !((await git__namespace.tagExists(tagName, cwd)) || (await git__namespace.remoteTagExists(tagName)));
    return {
      pkg,
      isMissingTag
    };
  }));
  const untagged = [];
  for (const packageWithTag of packageWithTags) {
    if (packageWithTag.isMissingTag) {
      untagged.push({
        name: packageWithTag.pkg.packageJson.name,
        newVersion: packageWithTag.pkg.packageJson.version,
        published: false
      });
    }
  }
  return untagged;
}

function logReleases(pkgs) {
  const mappedPkgs = pkgs.map(p => `${p.name}@${p.newVersion}`).join("\n");
  logger.log(mappedPkgs);
}
let importantSeparator$1 = pc__default["default"].red("===============================IMPORTANT!===============================");
let importantEnd$1 = pc__default["default"].red("----------------------------------------------------------------------");
function showNonLatestTagWarning(tag, preState) {
  logger.warn(importantSeparator$1);
  if (preState) {
    logger.warn(`You are in prerelease mode so packages will be published to the ${pc__default["default"].cyan(preState.tag)}
        dist tag except for packages that have not had normal releases which will be published to ${pc__default["default"].cyan("latest")}`);
  } else if (tag !== "latest") {
    logger.warn(`Packages will be released under the ${tag} tag`);
  }
  logger.warn(importantEnd$1);
}
async function publish(cwd, {
  otp,
  tag,
  gitTag = true
}, config) {
  const releaseTag = tag && tag.length > 0 ? tag : undefined;
  let preState = await pre$1.readPreState(cwd);
  if (releaseTag && preState && preState.mode === "pre") {
    logger.error("Releasing under custom tag is not allowed in pre mode");
    logger.log("To resolve this exit the pre mode by running `changeset pre exit`");
    throw new errors.ExitError(1);
  }
  if (releaseTag || preState) {
    showNonLatestTagWarning(tag, preState);
  }
  const {
    packages,
    tool
  } = await getPackages.getPackages(cwd);
  const tagPrivatePackages = config.privatePackages && config.privatePackages.tag;
  const publishedPackages = await publishPackages({
    packages,
    // if not public, we won't pass the access, and it works as normal
    access: config.access,
    otp,
    preState,
    tag: releaseTag
  });
  const privatePackages = packages.filter(pkg => pkg.packageJson.private && pkg.packageJson.version);
  const untaggedPrivatePackageReleases = tagPrivatePackages ? await getUntaggedPackages(privatePackages, cwd, tool) : [];
  if (publishedPackages.length === 0 && untaggedPrivatePackageReleases.length === 0) {
    logger.warn("No unpublished projects to publish");
  }
  const successfulNpmPublishes = publishedPackages.filter(p => p.published);
  const unsuccessfulNpmPublishes = publishedPackages.filter(p => !p.published);
  if (successfulNpmPublishes.length > 0) {
    logger.success("packages published successfully:");
    logReleases(successfulNpmPublishes);
    if (gitTag) {
      // We create the tags after the push above so that we know that HEAD won't change and that pushing
      // won't suffer from a race condition if another merge happens in the mean time (pushing tags won't
      // fail if we are behind the base branch).
      logger.log(`Creating git tag${successfulNpmPublishes.length > 1 ? "s" : ""}...`);
      await tagPublish(tool, successfulNpmPublishes, cwd);
    }
  }
  if (untaggedPrivatePackageReleases.length > 0) {
    logger.success("found untagged projects:");
    logReleases(untaggedPrivatePackageReleases);
    await tagPublish(tool, untaggedPrivatePackageReleases, cwd);
  }
  if (unsuccessfulNpmPublishes.length > 0) {
    logger.error("packages failed to publish:");
    logReleases(unsuccessfulNpmPublishes);
    throw new errors.ExitError(1);
  }
}
async function tagPublish(tool, packageReleases, cwd) {
  if (tool !== "root") {
    for (const pkg of packageReleases) {
      const tag = `${pkg.name}@${pkg.newVersion}`;
      logger.log("New tag: ", tag);
      await git__namespace.tag(tag, cwd);
    }
  } else {
    const tag = `v${packageReleases[0].newVersion}`;
    logger.log("New tag: ", tag);
    await git__namespace.tag(tag, cwd);
  }
}

async function status(cwd, {
  sinceMaster,
  since,
  verbose,
  output
}, config) {
  if (sinceMaster) {
    logger.warn("--sinceMaster is deprecated and will be removed in a future major version");
    logger.warn("Use --since=master instead");
  }
  const sinceBranch = since === undefined ? sinceMaster ? "master" : undefined : since;
  const releasePlan = await getReleasePlan__default["default"](cwd, sinceBranch, config);
  const {
    changesets,
    releases
  } = releasePlan;
  const changedPackages = await getVersionableChangedPackages(config, {
    cwd,
    ref: sinceBranch
  });
  if (changedPackages.length > 0 && changesets.length === 0) {
    logger.error("Some packages have been changed but no changesets were found. Run `changeset add` to resolve this error.");
    logger.error("If this change doesn't need a release, run `changeset add --empty`.");
    process.exit(1);
  }
  if (output) {
    await fs__default["default"].writeFile(path__default["default"].join(cwd, output), JSON.stringify(releasePlan, undefined, 2));
    return;
  }
  const print = verbose ? verbosePrint : SimplePrint;
  print("patch", releases);
  logger.log("---");
  print("minor", releases);
  logger.log("---");
  print("major", releases);
  return releasePlan;
}
function SimplePrint(type, releases) {
  const packages = releases.filter(r => r.type === type);
  if (packages.length) {
    logger.info(`Packages to be bumped at ${pc__default["default"].green(type)}:\n`);
    const pkgs = packages.map(({
      name
    }) => `- ${name}`).join("\n");
    logger.log(pc__default["default"].green(pkgs));
  } else {
    logger.info(`${pc__default["default"].green("NO")} packages to be bumped at ${pc__default["default"].green(type)}`);
  }
}
function verbosePrint(type, releases) {
  const packages = releases.filter(r => r.type === type);
  if (packages.length) {
    logger.info(`Packages to be bumped at ${pc__default["default"].green(type)}`);
    for (const {
      name,
      newVersion: version,
      changesets
    } of packages) {
      logger.log(`- ${pc__default["default"].green(name)} ${pc__default["default"].cyan(version)}`);
      for (const c of changesets) {
        logger.log(`  - ${pc__default["default"].blue(`.changeset/${c}.md`)}`);
      }
    }
  } else {
    logger.info(`Running release would release ${pc__default["default"].red("NO")} packages as a ${pc__default["default"].green(type)}`);
  }
}

async function tag(cwd, config) {
  const {
    packages,
    tool
  } = await getPackages.getPackages(cwd);
  const allExistingTags = await git__namespace.getAllTags(cwd);
  const taggablePackages = packages.filter(pkg => !shouldSkipPackage.shouldSkipPackage(pkg, {
    ignore: config.ignore,
    allowPrivatePackages: config.privatePackages.tag
  }));
  for (const {
    name,
    newVersion
  } of await getUntaggedPackages(taggablePackages, cwd, tool)) {
    const tag = tool !== "root" ? `${name}@${newVersion}` : `v${newVersion}`;
    if (allExistingTags.has(tag)) {
      logger.log("Skipping tag (already exists): ", tag);
    } else {
      logger.log("New tag: ", tag);
      await git__namespace.tag(tag, cwd);
    }
  }
}

// This helper is designed to operate on the .changeset
// folder, and tidy up the subfolders
// THIS SHOULD BE REMOVED WHEN SUPPORT FOR CHANGESETS FROM V1 IS DROPPED

const removeEmptyFolders = async folderPath => {
  const dirContents = fs__default["default"].readdirSync(folderPath);
  return Promise.all(dirContents.map(async contentPath => {
    const singleChangesetPath = path__default["default"].resolve(folderPath, contentPath);
    try {
      if ((await fs__default["default"].readdir(singleChangesetPath)).length < 1) {
        await fs__default["default"].rmdir(singleChangesetPath);
      }
    } catch (err) {
      if (err.code !== "ENOTDIR") {
        throw err;
      }
    }
  }));
};

let importantSeparator = pc__default["default"].red("===============================IMPORTANT!===============================");
let importantEnd = pc__default["default"].red("----------------------------------------------------------------------");
async function version(cwd, options, config) {
  var _config$snapshot$prer;
  const releaseConfig = _objectSpread2(_objectSpread2({}, config), {}, {
    // Disable committing when in snapshot mode
    commit: options.snapshot ? false : config.commit
  });
  const [changesets, preState] = await Promise.all([readChangesets__default["default"](cwd), pre$1.readPreState(cwd), removeEmptyFolders(path__default["default"].resolve(cwd, ".changeset"))]);
  if ((preState === null || preState === void 0 ? void 0 : preState.mode) === "pre") {
    logger.warn(importantSeparator);
    if (options.snapshot !== undefined) {
      logger.error("Snapshot release is not allowed in pre mode");
      logger.log("To resolve this exit the pre mode by running `changeset pre exit`");
      throw new errors.ExitError(1);
    } else {
      logger.warn("You are in prerelease mode");
      logger.warn("If you meant to do a normal release you should revert these changes and run `changeset pre exit`");
      logger.warn("You can then run `changeset version` again to do a normal release");
    }
    logger.warn(importantEnd);
  }
  if (changesets.length === 0 && (preState === undefined || preState.mode !== "exit")) {
    logger.warn("No unreleased changesets found, exiting.");
    return;
  }
  let packages = await getPackages.getPackages(cwd);
  let releasePlan = assembleReleasePlan__default["default"](changesets, packages, releaseConfig, preState, options.snapshot ? {
    tag: options.snapshot === true ? undefined : options.snapshot,
    commit: (_config$snapshot$prer = config.snapshot.prereleaseTemplate) !== null && _config$snapshot$prer !== void 0 && _config$snapshot$prer.includes("{commit}") ? await git.getCurrentCommitId({
      cwd
    }) : undefined
  } : undefined);
  let [...touchedFiles] = await applyReleasePlan__default["default"](releasePlan, packages, releaseConfig, options.snapshot, __dirname);
  const [{
    getVersionMessage
  }, commitOpts] = getCommitFunctions(releaseConfig.commit, cwd);
  if (getVersionMessage) {
    let touchedFile;
    // Note, git gets angry if you try and have two git actions running at once
    // So we need to be careful that these iterations are properly sequential
    while (touchedFile = touchedFiles.shift()) {
      await git__namespace.add(path__default["default"].relative(cwd, touchedFile), cwd);
    }
    const commit = await git__namespace.commit(await getVersionMessage(releasePlan, commitOpts), cwd);
    if (!commit) {
      logger.error("Changesets ran into trouble committing your files");
    } else {
      logger.log("All files have been updated and committed. You're ready to publish!");
    }
  } else {
    logger.log("All files have been updated. Review them and commit at your leisure");
  }
}

async function run(input, flags, cwd) {
  if (input[0] === "init") {
    await init(cwd);
    return;
  }
  if (!fs__default["default"].existsSync(path__default["default"].resolve(cwd, ".changeset"))) {
    logger.error("There is no .changeset folder. ");
    logger.error("If this is the first time `changesets` have been used in this project, run `yarn changeset init` to get set up.");
    logger.error("If you expected there to be changesets, you should check git history for when the folder was removed to ensure you do not lose any configuration.");
    throw new errors.ExitError(1);
  }
  const packages = await getPackages.getPackages(cwd);
  let config$1;
  try {
    config$1 = await config.read(cwd, packages);
  } catch (e) {
    let oldConfigExists = await fs__default["default"].pathExists(path__default["default"].resolve(cwd, ".changeset/config.js"));
    if (oldConfigExists) {
      logger.error("It looks like you're using the version 1 `.changeset/config.js` file");
      logger.error("You'll need to convert it to a `.changeset/config.json` file");
      logger.error("The format of the config object has significantly changed in v2 as well");
      logger.error(" - we thoroughly recommend looking at the changelog for this package for what has changed");
      throw new errors.ExitError(1);
    } else {
      throw e;
    }
  }
  if (input.length < 1) {
    const {
      empty,
      open
    } = flags;
    // @ts-ignore if this is undefined, we have already exited
    await add(cwd, {
      empty,
      open
    }, config$1);
  } else if (input[0] !== "pre" && input.length > 1) {
    logger.error("Too many arguments passed to changesets - we only accept the command name as an argument");
  } else {
    const {
      sinceMaster,
      since,
      verbose,
      output,
      otp,
      empty,
      ignore,
      snapshot,
      snapshotPrereleaseTemplate,
      tag: tag$1,
      open,
      gitTag
    } = flags;
    const deadFlags = ["updateChangelog", "isPublic", "skipCI", "commit"];
    deadFlags.forEach(flag => {
      if (flags[flag]) {
        logger.error(`the flag ${flag} has been removed from changesets for version 2`);
        logger.error(`Please encode the desired value into your config`);
        logger.error(`See our changelog for more details`);
        throw new errors.ExitError(1);
      }
    });

    // Command line options need to be undefined, otherwise their
    // default value overrides the user's provided config in their
    // config file. For this reason, we only assign them to this
    // object as and when they exist.

    switch (input[0]) {
      case "add":
        {
          await add(cwd, {
            empty,
            open
          }, config$1);
          return;
        }
      case "version":
        {
          let ignoreArrayFromCmd;
          if (typeof ignore === "string") {
            ignoreArrayFromCmd = [ignore];
          } else {
            // undefined or an array
            ignoreArrayFromCmd = ignore;
          }

          // Validate that items in ignoreArrayFromCmd are valid project names
          let pkgNames = new Set(packages.packages.map(({
            packageJson
          }) => packageJson.name));
          const messages = [];
          for (const pkgName of ignoreArrayFromCmd || []) {
            if (!pkgNames.has(pkgName)) {
              messages.push(`The package "${pkgName}" is passed to the \`--ignore\` option but it is not found in the project. You may have misspelled the package name.`);
            }
          }
          if (config$1.ignore.length > 0 && ignoreArrayFromCmd) {
            messages.push(`It looks like you are trying to use the \`--ignore\` option while ignore is defined in the config file. This is currently not allowed, you can only use one of them at a time.`);
          } else if (ignoreArrayFromCmd) {
            // use the ignore flags from cli
            config$1.ignore = ignoreArrayFromCmd;
          }
          const packagesByName = new Map(packages.packages.map(x => [x.packageJson.name, x]));

          // validate that all dependents of skipped packages are also skipped
          const dependentsGraph = getDependentsGraph.getDependentsGraph(packages, {
            ignoreDevDependencies: true,
            bumpVersionsWithWorkspaceProtocolOnly: config$1.bumpVersionsWithWorkspaceProtocolOnly
          });
          for (const pkg of packages.packages) {
            if (!shouldSkipPackage.shouldSkipPackage(pkg, {
              ignore: config$1.ignore,
              allowPrivatePackages: config$1.privatePackages.version
            })) {
              continue;
            }
            const skippedPackage = pkg.packageJson.name;
            const dependents = dependentsGraph.get(skippedPackage) || [];
            for (const dependent of dependents) {
              const dependentPkg = packagesByName.get(dependent);
              if (!shouldSkipPackage.shouldSkipPackage(dependentPkg, {
                ignore: config$1.ignore,
                allowPrivatePackages: config$1.privatePackages.version
              })) {
                messages.push(`The package "${dependent}" depends on the skipped package "${skippedPackage}" (either by \`ignore\` option or by \`privatePackages.version\`), but "${dependent}" is not being skipped. Please pass "${dependent}" to the \`--ignore\` flag.`);
              }
            }
          }
          if (messages.length > 0) {
            logger.error(messages.join("\n"));
            throw new errors.ExitError(1);
          }
          if (snapshotPrereleaseTemplate) {
            config$1.snapshot.prereleaseTemplate = snapshotPrereleaseTemplate;
          }
          await version(cwd, {
            snapshot
          }, config$1);
          return;
        }
      case "publish":
        {
          await publish(cwd, {
            otp,
            tag: tag$1,
            gitTag
          }, config$1);
          return;
        }
      case "status":
        {
          await status(cwd, {
            sinceMaster,
            since,
            verbose,
            output
          }, config$1);
          return;
        }
      case "tag":
        {
          await tag(cwd, config$1);
          return;
        }
      case "pre":
        {
          let command = input[1];
          if (command !== "enter" && command !== "exit") {
            logger.error("`enter`, `exit` or `snapshot` must be passed after prerelease");
            throw new errors.ExitError(1);
          }
          let tag = input[2];
          if (command === "enter" && typeof tag !== "string") {
            logger.error(`A tag must be passed when using prerelese enter`);
            throw new errors.ExitError(1);
          }
          // @ts-ignore
          await pre(cwd, {
            command,
            tag
          });
          return;
        }
      case "bump":
        {
          logger.error('In version 2 of changesets, "bump" has been renamed to "version" - see our changelog for an explanation');
          logger.error("To fix this, use `changeset version` instead, and update any scripts that use changesets");
          throw new errors.ExitError(1);
        }
      case "release":
        {
          logger.error('In version 2 of changesets, "release" has been renamed to "publish" - see our changelog for an explanation');
          logger.error("To fix this, use `changeset publish` instead, and update any scripts that use changesets");
          throw new errors.ExitError(1);
        }
      default:
        {
          logger.error(`Invalid command ${input[0]} was provided`);
          throw new errors.ExitError(1);
        }
    }
  }
}

const args = process.argv.slice(2);
const parsed = mri__default["default"](args, {
  boolean: ["sinceMaster", "verbose", "empty", "open", "gitTag", "snapshot"],
  string: ["output", "otp", "since", "ignore", "tag", "snapshot", "snapshotPrereleaseTemplate"],
  alias: {
    // Short flags
    v: "verbose",
    o: "output",
    // Support kebab-case flags
    "since-master": "sinceMaster",
    "git-tag": "gitTag",
    "snapshot-prerelease-template": "snapshotPrereleaseTemplate",
    // Deprecated flags
    "update-changelog": "updateChangelog",
    "is-public": "isPublic",
    "skip-c-i": "skipCI"
  },
  default: {
    gitTag: true
  }
});

// `mri` doesn't handle mixed boolean and strings well. It'll always try to coerce it as
// a string even if only `--snapshot` is passed. We check here if this was the case and
// try to coerce it as a boolean
if (parsed.snapshot === "" && args[args.indexOf("--snapshot") + 1] !== "") {
  parsed.snapshot = true;
}

// Help message should only be shown if it's the only argument passed
if (parsed.help && args.length === 1) {
  console.log(`
  Organise your package versioning and publishing to make both contributors and maintainers happy

  Usage
    $ changeset [command]
  Commands
    init
    add [--empty] [--open]
    version [--ignore] [--snapshot <?name>] [--snapshot-prerelease-template <template>]
    publish [--tag <name>] [--otp <code>] [--no-git-tag]
    status [--since <branch>] [--verbose] [--output JSON_FILE.json]
    pre <enter|exit> <tag>
    tag

    `);
  process.exit(0);
}

// Version should only be shown if it's the only argument passed
if (parsed.version && args.length === 1) {
  // eslint-disable-next-line import/no-extraneous-dependencies
  console.log(require("@changesets/cli/package.json").version);
  process.exit(0);
}
const cwd = process.cwd();
run(parsed._, parsed, cwd).catch(err => {
  if (err instanceof errors.InternalError) {
    logger.error("The following error is an internal unexpected error, these should never happen.");
    logger.error("Please open an issue with the following link");
    logger.error(`https://github.com/changesets/changesets/issues/new?title=${encodeURIComponent(`Unexpected error during ${parsed._[0] || "add"} command`)}&body=${encodeURIComponent(`## Error

\`\`\`
${util.format("", err).replace(process.cwd(), "<cwd>")}
\`\`\`

## Versions

- @changesets/cli@${
    // eslint-disable-next-line import/no-extraneous-dependencies
    require("@changesets/cli/package.json").version}
- node@${process.version}

## Extra details

<!-- Add any extra details of what you were doing, ideas you have about what might have caused the error and reproduction steps if possible. If you have a repository we can look at that would be great. 😁 -->
`)}`);
  }
  if (err instanceof errors.ExitError) {
    return process.exit(err.code);
  }
  logger.error(err);
  process.exit(1);
});
