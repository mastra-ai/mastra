'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _regeneratorRuntime = _interopDefault(require('@babel/runtime/regenerator'));
var _asyncToGenerator = _interopDefault(require('@babel/runtime/helpers/asyncToGenerator'));
var _classCallCheck = _interopDefault(require('@babel/runtime/helpers/classCallCheck'));
var _possibleConstructorReturn = _interopDefault(require('@babel/runtime/helpers/possibleConstructorReturn'));
var _getPrototypeOf = _interopDefault(require('@babel/runtime/helpers/getPrototypeOf'));
var _inherits = _interopDefault(require('@babel/runtime/helpers/inherits'));
var _wrapNativeSuper = _interopDefault(require('@babel/runtime/helpers/wrapNativeSuper'));
var fs = _interopDefault(require('fs-extra'));
var path = _interopDefault(require('path'));
var globby = require('globby');
var globby__default = _interopDefault(globby);
var readYamlFile = require('read-yaml-file');
var readYamlFile__default = _interopDefault(readYamlFile);
var findRoot = require('@manypkg/find-root');

var PackageJsonMissingNameError =
/*#__PURE__*/
function (_Error) {
  _inherits(PackageJsonMissingNameError, _Error);

  function PackageJsonMissingNameError(directories) {
    var _this;

    _classCallCheck(this, PackageJsonMissingNameError);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(PackageJsonMissingNameError).call(this, "The following package.jsons are missing the \"name\" field:\n".concat(directories.join("\n"))));
    _this.directories = directories;
    return _this;
  }

  return PackageJsonMissingNameError;
}(_wrapNativeSuper(Error));
function getPackages(_x) {
  return _getPackages.apply(this, arguments);
}

function _getPackages() {
  _getPackages = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee(dir) {
    var cwd, pkg, tool, manifest, lernaJson, root, relativeDirectories, directories, pkgJsonsMissingNameField, results;
    return _regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return findRoot.findRoot(dir);

          case 2:
            cwd = _context.sent;
            _context.next = 5;
            return fs.readJson(path.join(cwd, "package.json"));

          case 5:
            pkg = _context.sent;

            if (!pkg.workspaces) {
              _context.next = 10;
              break;
            }

            if (Array.isArray(pkg.workspaces)) {
              tool = {
                type: "yarn",
                packageGlobs: pkg.workspaces
              };
            } else if (pkg.workspaces.packages) {
              tool = {
                type: "yarn",
                packageGlobs: pkg.workspaces.packages
              };
            }

            _context.next = 37;
            break;

          case 10:
            if (!(pkg.bolt && pkg.bolt.workspaces)) {
              _context.next = 14;
              break;
            }

            tool = {
              type: "bolt",
              packageGlobs: pkg.bolt.workspaces
            };
            _context.next = 37;
            break;

          case 14:
            _context.prev = 14;
            _context.next = 17;
            return readYamlFile__default(path.join(cwd, "pnpm-workspace.yaml"));

          case 17:
            manifest = _context.sent;

            if (manifest && manifest.packages) {
              tool = {
                type: "pnpm",
                packageGlobs: manifest.packages
              };
            }

            _context.next = 25;
            break;

          case 21:
            _context.prev = 21;
            _context.t0 = _context["catch"](14);

            if (!(_context.t0.code !== "ENOENT")) {
              _context.next = 25;
              break;
            }

            throw _context.t0;

          case 25:
            if (tool) {
              _context.next = 37;
              break;
            }

            _context.prev = 26;
            _context.next = 29;
            return fs.readJson(path.join(cwd, "lerna.json"));

          case 29:
            lernaJson = _context.sent;

            if (lernaJson) {
              tool = {
                type: "lerna",
                packageGlobs: lernaJson.packages || ["packages/*"]
              };
            }

            _context.next = 37;
            break;

          case 33:
            _context.prev = 33;
            _context.t1 = _context["catch"](26);

            if (!(_context.t1.code !== "ENOENT")) {
              _context.next = 37;
              break;
            }

            throw _context.t1;

          case 37:
            if (tool) {
              _context.next = 42;
              break;
            }

            root = {
              dir: cwd,
              packageJson: pkg
            };

            if (pkg.name) {
              _context.next = 41;
              break;
            }

            throw new PackageJsonMissingNameError(["package.json"]);

          case 41:
            return _context.abrupt("return", {
              tool: "root",
              root: root,
              packages: [root]
            });

          case 42:
            _context.next = 44;
            return globby__default(tool.packageGlobs, {
              cwd: cwd,
              onlyDirectories: true,
              expandDirectories: false,
              ignore: ["**/node_modules"]
            });

          case 44:
            relativeDirectories = _context.sent;
            directories = relativeDirectories.map(function (p) {
              return path.resolve(cwd, p);
            });
            pkgJsonsMissingNameField = [];
            _context.next = 49;
            return Promise.all(directories.sort().map(function (dir) {
              return fs.readJson(path.join(dir, "package.json")).then(function (packageJson) {
                if (!packageJson.name) {
                  pkgJsonsMissingNameField.push(path.relative(cwd, path.join(dir, "package.json")));
                }

                return {
                  packageJson: packageJson,
                  dir: dir
                };
              })["catch"](function (err) {
                if (err.code === "ENOENT") {
                  return null;
                }

                throw err;
              });
            }));

          case 49:
            _context.t2 = function (x) {
              return x;
            };

            results = _context.sent.filter(_context.t2);

            if (!(pkgJsonsMissingNameField.length !== 0)) {
              _context.next = 54;
              break;
            }

            pkgJsonsMissingNameField.sort();
            throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);

          case 54:
            return _context.abrupt("return", {
              tool: tool.type,
              root: {
                dir: cwd,
                packageJson: pkg
              },
              packages: results
            });

          case 55:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, null, [[14, 21], [26, 33]]);
  }));
  return _getPackages.apply(this, arguments);
}

function getPackagesSync(dir) {
  var cwd = findRoot.findRootSync(dir);
  var pkg = fs.readJsonSync(path.join(cwd, "package.json"));
  var tool;

  if (pkg.workspaces) {
    if (Array.isArray(pkg.workspaces)) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces
      };
    } else if (pkg.workspaces.packages) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces.packages
      };
    }
  } else if (pkg.bolt && pkg.bolt.workspaces) {
    tool = {
      type: "bolt",
      packageGlobs: pkg.bolt.workspaces
    };
  } else {
    try {
      var manifest = readYamlFile.sync(path.join(cwd, "pnpm-workspace.yaml"));

      if (manifest && manifest.packages) {
        tool = {
          type: "pnpm",
          packageGlobs: manifest.packages
        };
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }

    if (!tool) {
      try {
        var lernaJson = fs.readJsonSync(path.join(cwd, "lerna.json"));

        if (lernaJson) {
          tool = {
            type: "lerna",
            packageGlobs: lernaJson.packages || ["packages/*"]
          };
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          throw err;
        }
      }
    }
  }

  if (!tool) {
    var root = {
      dir: cwd,
      packageJson: pkg
    };

    if (!pkg.name) {
      throw new PackageJsonMissingNameError(["package.json"]);
    }

    return {
      tool: "root",
      root: root,
      packages: [root]
    };
  }

  var relativeDirectories = globby.sync(tool.packageGlobs, {
    cwd: cwd,
    onlyDirectories: true,
    expandDirectories: false,
    ignore: ["**/node_modules"]
  });
  var directories = relativeDirectories.map(function (p) {
    return path.resolve(cwd, p);
  });
  var pkgJsonsMissingNameField = [];
  var results = directories.sort().map(function (dir) {
    try {
      var packageJson = fs.readJsonSync(path.join(dir, "package.json"));

      if (!packageJson.name) {
        pkgJsonsMissingNameField.push(path.relative(cwd, path.join(dir, "package.json")));
      }

      return {
        packageJson: packageJson,
        dir: dir
      };
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }).filter(function (x) {
    return x;
  });

  if (pkgJsonsMissingNameField.length !== 0) {
    pkgJsonsMissingNameField.sort();
    throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  }

  return {
    tool: tool.type,
    root: {
      dir: cwd,
      packageJson: pkg
    },
    packages: results
  };
}

exports.PackageJsonMissingNameError = PackageJsonMissingNameError;
exports.getPackages = getPackages;
exports.getPackagesSync = getPackagesSync;
