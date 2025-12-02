"use strict";

function _interopDefault(ex) {
  return ex && "object" == typeof ex && "default" in ex ? ex.default : ex;
}

Object.defineProperty(exports, "__esModule", {
  value: !0
});

var _regeneratorRuntime = _interopDefault(require("@babel/runtime/regenerator")), _asyncToGenerator = _interopDefault(require("@babel/runtime/helpers/asyncToGenerator")), _classCallCheck = _interopDefault(require("@babel/runtime/helpers/classCallCheck")), _possibleConstructorReturn = _interopDefault(require("@babel/runtime/helpers/possibleConstructorReturn")), _getPrototypeOf = _interopDefault(require("@babel/runtime/helpers/getPrototypeOf")), _inherits = _interopDefault(require("@babel/runtime/helpers/inherits")), _wrapNativeSuper = _interopDefault(require("@babel/runtime/helpers/wrapNativeSuper")), fs = _interopDefault(require("fs-extra")), path = _interopDefault(require("path")), globby = require("globby"), globby__default = _interopDefault(globby), readYamlFile = require("read-yaml-file"), readYamlFile__default = _interopDefault(readYamlFile), findRoot = require("@manypkg/find-root"), PackageJsonMissingNameError = function(_Error) {
  function PackageJsonMissingNameError(directories) {
    var _this;
    return _classCallCheck(this, PackageJsonMissingNameError), (_this = _possibleConstructorReturn(this, _getPrototypeOf(PackageJsonMissingNameError).call(this, 'The following package.jsons are missing the "name" field:\n'.concat(directories.join("\n"))))).directories = directories, 
    _this;
  }
  return _inherits(PackageJsonMissingNameError, _Error), PackageJsonMissingNameError;
}(_wrapNativeSuper(Error));

function getPackages(_x) {
  return _getPackages.apply(this, arguments);
}

function _getPackages() {
  return (_getPackages = _asyncToGenerator(_regeneratorRuntime.mark(function _callee(dir) {
    var cwd, pkg, tool, manifest, lernaJson, root, relativeDirectories, directories, pkgJsonsMissingNameField, results;
    return _regeneratorRuntime.wrap(function(_context) {
      for (;;) switch (_context.prev = _context.next) {
       case 0:
        return _context.next = 2, findRoot.findRoot(dir);

       case 2:
        return cwd = _context.sent, _context.next = 5, fs.readJson(path.join(cwd, "package.json"));

       case 5:
        if (!(pkg = _context.sent).workspaces) {
          _context.next = 10;
          break;
        }
        Array.isArray(pkg.workspaces) ? tool = {
          type: "yarn",
          packageGlobs: pkg.workspaces
        } : pkg.workspaces.packages && (tool = {
          type: "yarn",
          packageGlobs: pkg.workspaces.packages
        }), _context.next = 37;
        break;

       case 10:
        if (!pkg.bolt || !pkg.bolt.workspaces) {
          _context.next = 14;
          break;
        }
        tool = {
          type: "bolt",
          packageGlobs: pkg.bolt.workspaces
        }, _context.next = 37;
        break;

       case 14:
        return _context.prev = 14, _context.next = 17, readYamlFile__default(path.join(cwd, "pnpm-workspace.yaml"));

       case 17:
        (manifest = _context.sent) && manifest.packages && (tool = {
          type: "pnpm",
          packageGlobs: manifest.packages
        }), _context.next = 25;
        break;

       case 21:
        if (_context.prev = 21, _context.t0 = _context.catch(14), "ENOENT" === _context.t0.code) {
          _context.next = 25;
          break;
        }
        throw _context.t0;

       case 25:
        if (tool) {
          _context.next = 37;
          break;
        }
        return _context.prev = 26, _context.next = 29, fs.readJson(path.join(cwd, "lerna.json"));

       case 29:
        (lernaJson = _context.sent) && (tool = {
          type: "lerna",
          packageGlobs: lernaJson.packages || [ "packages/*" ]
        }), _context.next = 37;
        break;

       case 33:
        if (_context.prev = 33, _context.t1 = _context.catch(26), "ENOENT" === _context.t1.code) {
          _context.next = 37;
          break;
        }
        throw _context.t1;

       case 37:
        if (tool) {
          _context.next = 42;
          break;
        }
        if (root = {
          dir: cwd,
          packageJson: pkg
        }, pkg.name) {
          _context.next = 41;
          break;
        }
        throw new PackageJsonMissingNameError([ "package.json" ]);

       case 41:
        return _context.abrupt("return", {
          tool: "root",
          root: root,
          packages: [ root ]
        });

       case 42:
        return _context.next = 44, globby__default(tool.packageGlobs, {
          cwd: cwd,
          onlyDirectories: !0,
          expandDirectories: !1,
          ignore: [ "**/node_modules" ]
        });

       case 44:
        return relativeDirectories = _context.sent, directories = relativeDirectories.map(function(p) {
          return path.resolve(cwd, p);
        }), pkgJsonsMissingNameField = [], _context.next = 49, Promise.all(directories.sort().map(function(dir) {
          return fs.readJson(path.join(dir, "package.json")).then(function(packageJson) {
            return packageJson.name || pkgJsonsMissingNameField.push(path.relative(cwd, path.join(dir, "package.json"))), 
            {
              packageJson: packageJson,
              dir: dir
            };
          }).catch(function(err) {
            if ("ENOENT" === err.code) return null;
            throw err;
          });
        }));

       case 49:
        if (_context.t2 = function(x) {
          return x;
        }, results = _context.sent.filter(_context.t2), 0 === pkgJsonsMissingNameField.length) {
          _context.next = 54;
          break;
        }
        throw pkgJsonsMissingNameField.sort(), new PackageJsonMissingNameError(pkgJsonsMissingNameField);

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
    }, _callee, null, [ [ 14, 21 ], [ 26, 33 ] ]);
  }))).apply(this, arguments);
}

function getPackagesSync(dir) {
  var tool, cwd = findRoot.findRootSync(dir), pkg = fs.readJsonSync(path.join(cwd, "package.json"));
  if (pkg.workspaces) Array.isArray(pkg.workspaces) ? tool = {
    type: "yarn",
    packageGlobs: pkg.workspaces
  } : pkg.workspaces.packages && (tool = {
    type: "yarn",
    packageGlobs: pkg.workspaces.packages
  }); else if (pkg.bolt && pkg.bolt.workspaces) tool = {
    type: "bolt",
    packageGlobs: pkg.bolt.workspaces
  }; else {
    try {
      var manifest = readYamlFile.sync(path.join(cwd, "pnpm-workspace.yaml"));
      manifest && manifest.packages && (tool = {
        type: "pnpm",
        packageGlobs: manifest.packages
      });
    } catch (err) {
      if ("ENOENT" !== err.code) throw err;
    }
    if (!tool) try {
      var lernaJson = fs.readJsonSync(path.join(cwd, "lerna.json"));
      lernaJson && (tool = {
        type: "lerna",
        packageGlobs: lernaJson.packages || [ "packages/*" ]
      });
    } catch (err) {
      if ("ENOENT" !== err.code) throw err;
    }
  }
  if (!tool) {
    var root = {
      dir: cwd,
      packageJson: pkg
    };
    if (!pkg.name) throw new PackageJsonMissingNameError([ "package.json" ]);
    return {
      tool: "root",
      root: root,
      packages: [ root ]
    };
  }
  var directories = globby.sync(tool.packageGlobs, {
    cwd: cwd,
    onlyDirectories: !0,
    expandDirectories: !1,
    ignore: [ "**/node_modules" ]
  }).map(function(p) {
    return path.resolve(cwd, p);
  }), pkgJsonsMissingNameField = [], results = directories.sort().map(function(dir) {
    try {
      var packageJson = fs.readJsonSync(path.join(dir, "package.json"));
      return packageJson.name || pkgJsonsMissingNameField.push(path.relative(cwd, path.join(dir, "package.json"))), 
      {
        packageJson: packageJson,
        dir: dir
      };
    } catch (err) {
      if ("ENOENT" === err.code) return null;
      throw err;
    }
  }).filter(function(x) {
    return x;
  });
  if (0 !== pkgJsonsMissingNameField.length) throw pkgJsonsMissingNameField.sort(), 
  new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  return {
    tool: tool.type,
    root: {
      dir: cwd,
      packageJson: pkg
    },
    packages: results
  };
}

exports.PackageJsonMissingNameError = PackageJsonMissingNameError, exports.getPackages = getPackages, 
exports.getPackagesSync = getPackagesSync;
