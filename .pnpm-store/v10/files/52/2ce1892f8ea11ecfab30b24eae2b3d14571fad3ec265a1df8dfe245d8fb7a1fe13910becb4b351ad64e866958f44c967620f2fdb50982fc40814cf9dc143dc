"use strict";

function _interopDefault(ex) {
  return ex && "object" == typeof ex && "default" in ex ? ex.default : ex;
}

Object.defineProperty(exports, "__esModule", {
  value: !0
});

var _regeneratorRuntime = _interopDefault(require("@babel/runtime/regenerator")), _asyncToGenerator = _interopDefault(require("@babel/runtime/helpers/asyncToGenerator")), _classCallCheck = _interopDefault(require("@babel/runtime/helpers/classCallCheck")), _possibleConstructorReturn = _interopDefault(require("@babel/runtime/helpers/possibleConstructorReturn")), _getPrototypeOf = _interopDefault(require("@babel/runtime/helpers/getPrototypeOf")), _inherits = _interopDefault(require("@babel/runtime/helpers/inherits")), _wrapNativeSuper = _interopDefault(require("@babel/runtime/helpers/wrapNativeSuper")), findUp = require("find-up"), findUp__default = _interopDefault(findUp), path = _interopDefault(require("path")), fs = _interopDefault(require("fs-extra")), NoPkgJsonFound = function(_Error) {
  function NoPkgJsonFound(directory) {
    var _this;
    return _classCallCheck(this, NoPkgJsonFound), (_this = _possibleConstructorReturn(this, _getPrototypeOf(NoPkgJsonFound).call(this, "No package.json could be found upwards from the directory ".concat(directory)))).directory = directory, 
    _this;
  }
  return _inherits(NoPkgJsonFound, _Error), NoPkgJsonFound;
}(_wrapNativeSuper(Error));

function hasWorkspacesConfiguredViaPkgJson(_x, _x2) {
  return _hasWorkspacesConfiguredViaPkgJson.apply(this, arguments);
}

function _hasWorkspacesConfiguredViaPkgJson() {
  return (_hasWorkspacesConfiguredViaPkgJson = _asyncToGenerator(_regeneratorRuntime.mark(function _callee(directory, firstPkgJsonDirRef) {
    var pkgJson;
    return _regeneratorRuntime.wrap(function(_context) {
      for (;;) switch (_context.prev = _context.next) {
       case 0:
        return _context.prev = 0, _context.next = 3, fs.readJson(path.join(directory, "package.json"));

       case 3:
        if (pkgJson = _context.sent, void 0 === firstPkgJsonDirRef.current && (firstPkgJsonDirRef.current = directory), 
        !pkgJson.workspaces && !pkgJson.bolt) {
          _context.next = 7;
          break;
        }
        return _context.abrupt("return", directory);

       case 7:
        _context.next = 13;
        break;

       case 9:
        if (_context.prev = 9, _context.t0 = _context.catch(0), "ENOENT" === _context.t0.code) {
          _context.next = 13;
          break;
        }
        throw _context.t0;

       case 13:
       case "end":
        return _context.stop();
      }
    }, _callee, null, [ [ 0, 9 ] ]);
  }))).apply(this, arguments);
}

function hasWorkspacesConfiguredViaLerna(_x3) {
  return _hasWorkspacesConfiguredViaLerna.apply(this, arguments);
}

function _hasWorkspacesConfiguredViaLerna() {
  return (_hasWorkspacesConfiguredViaLerna = _asyncToGenerator(_regeneratorRuntime.mark(function _callee2(directory) {
    return _regeneratorRuntime.wrap(function(_context2) {
      for (;;) switch (_context2.prev = _context2.next) {
       case 0:
        return _context2.prev = 0, _context2.next = 3, fs.readJson(path.join(directory, "lerna.json"));

       case 3:
        if (!0 === _context2.sent.useWorkspaces) {
          _context2.next = 6;
          break;
        }
        return _context2.abrupt("return", directory);

       case 6:
        _context2.next = 12;
        break;

       case 8:
        if (_context2.prev = 8, _context2.t0 = _context2.catch(0), "ENOENT" === _context2.t0.code) {
          _context2.next = 12;
          break;
        }
        throw _context2.t0;

       case 12:
       case "end":
        return _context2.stop();
      }
    }, _callee2, null, [ [ 0, 8 ] ]);
  }))).apply(this, arguments);
}

function hasWorkspacesConfiguredViaPnpm(_x4) {
  return _hasWorkspacesConfiguredViaPnpm.apply(this, arguments);
}

function _hasWorkspacesConfiguredViaPnpm() {
  return (_hasWorkspacesConfiguredViaPnpm = _asyncToGenerator(_regeneratorRuntime.mark(function _callee3(directory) {
    return _regeneratorRuntime.wrap(function(_context3) {
      for (;;) switch (_context3.prev = _context3.next) {
       case 0:
        return _context3.next = 2, fs.exists(path.join(directory, "pnpm-workspace.yaml"));

       case 2:
        if (!_context3.sent) {
          _context3.next = 5;
          break;
        }
        return _context3.abrupt("return", directory);

       case 5:
       case "end":
        return _context3.stop();
      }
    }, _callee3);
  }))).apply(this, arguments);
}

function findRoot(_x5) {
  return _findRoot.apply(this, arguments);
}

function _findRoot() {
  return (_findRoot = _asyncToGenerator(_regeneratorRuntime.mark(function _callee4(cwd) {
    var firstPkgJsonDirRef, dir;
    return _regeneratorRuntime.wrap(function(_context4) {
      for (;;) switch (_context4.prev = _context4.next) {
       case 0:
        return firstPkgJsonDirRef = {
          current: void 0
        }, _context4.next = 3, findUp__default(function(directory) {
          return Promise.all([ hasWorkspacesConfiguredViaLerna(directory), hasWorkspacesConfiguredViaPkgJson(directory, firstPkgJsonDirRef), hasWorkspacesConfiguredViaPnpm(directory) ]).then(function(x) {
            return x.find(function(dir) {
              return dir;
            });
          });
        }, {
          cwd: cwd,
          type: "directory"
        });

       case 3:
        if (dir = _context4.sent, void 0 !== firstPkgJsonDirRef.current) {
          _context4.next = 6;
          break;
        }
        throw new NoPkgJsonFound(cwd);

       case 6:
        if (void 0 !== dir) {
          _context4.next = 8;
          break;
        }
        return _context4.abrupt("return", firstPkgJsonDirRef.current);

       case 8:
        return _context4.abrupt("return", dir);

       case 9:
       case "end":
        return _context4.stop();
      }
    }, _callee4);
  }))).apply(this, arguments);
}

function hasWorkspacesConfiguredViaPkgJsonSync(directory, firstPkgJsonDirRef) {
  try {
    var pkgJson = fs.readJsonSync(path.join(directory, "package.json"));
    if (void 0 === firstPkgJsonDirRef.current && (firstPkgJsonDirRef.current = directory), 
    pkgJson.workspaces || pkgJson.bolt) return directory;
  } catch (err) {
    if ("ENOENT" !== err.code) throw err;
  }
}

function hasWorkspacesConfiguredViaLernaSync(directory) {
  try {
    if (!0 !== fs.readJsonSync(path.join(directory, "lerna.json")).useWorkspaces) return directory;
  } catch (err) {
    if ("ENOENT" !== err.code) throw err;
  }
}

function hasWorkspacesConfiguredViaPnpmSync(directory) {
  if (fs.existsSync(path.join(directory, "pnpm-workspace.yaml"))) return directory;
}

function findRootSync(cwd) {
  var firstPkgJsonDirRef = {
    current: void 0
  }, dir = findUp.sync(function(directory) {
    return [ hasWorkspacesConfiguredViaLernaSync(directory), hasWorkspacesConfiguredViaPkgJsonSync(directory, firstPkgJsonDirRef), hasWorkspacesConfiguredViaPnpmSync(directory) ].find(function(dir) {
      return dir;
    });
  }, {
    cwd: cwd,
    type: "directory"
  });
  if (void 0 === firstPkgJsonDirRef.current) throw new NoPkgJsonFound(cwd);
  return void 0 === dir ? firstPkgJsonDirRef.current : dir;
}

exports.NoPkgJsonFound = NoPkgJsonFound, exports.findRoot = findRoot, exports.findRootSync = findRootSync;
