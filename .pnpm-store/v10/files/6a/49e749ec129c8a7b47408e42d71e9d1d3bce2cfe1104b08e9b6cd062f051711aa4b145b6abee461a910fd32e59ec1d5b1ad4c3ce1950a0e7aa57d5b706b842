import _regeneratorRuntime from '@babel/runtime/regenerator';
import _asyncToGenerator from '@babel/runtime/helpers/esm/asyncToGenerator';
import _classCallCheck from '@babel/runtime/helpers/esm/classCallCheck';
import _possibleConstructorReturn from '@babel/runtime/helpers/esm/possibleConstructorReturn';
import _getPrototypeOf from '@babel/runtime/helpers/esm/getPrototypeOf';
import _inherits from '@babel/runtime/helpers/esm/inherits';
import _wrapNativeSuper from '@babel/runtime/helpers/esm/wrapNativeSuper';
import findUp, { sync } from 'find-up';
import path from 'path';
import fs from 'fs-extra';

var NoPkgJsonFound =
/*#__PURE__*/
function (_Error) {
  _inherits(NoPkgJsonFound, _Error);

  function NoPkgJsonFound(directory) {
    var _this;

    _classCallCheck(this, NoPkgJsonFound);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(NoPkgJsonFound).call(this, "No package.json could be found upwards from the directory ".concat(directory)));
    _this.directory = directory;
    return _this;
  }

  return NoPkgJsonFound;
}(_wrapNativeSuper(Error));

function hasWorkspacesConfiguredViaPkgJson(_x, _x2) {
  return _hasWorkspacesConfiguredViaPkgJson.apply(this, arguments);
}

function _hasWorkspacesConfiguredViaPkgJson() {
  _hasWorkspacesConfiguredViaPkgJson = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee(directory, firstPkgJsonDirRef) {
    var pkgJson;
    return _regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            _context.next = 3;
            return fs.readJson(path.join(directory, "package.json"));

          case 3:
            pkgJson = _context.sent;

            if (firstPkgJsonDirRef.current === undefined) {
              firstPkgJsonDirRef.current = directory;
            }

            if (!(pkgJson.workspaces || pkgJson.bolt)) {
              _context.next = 7;
              break;
            }

            return _context.abrupt("return", directory);

          case 7:
            _context.next = 13;
            break;

          case 9:
            _context.prev = 9;
            _context.t0 = _context["catch"](0);

            if (!(_context.t0.code !== "ENOENT")) {
              _context.next = 13;
              break;
            }

            throw _context.t0;

          case 13:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, null, [[0, 9]]);
  }));
  return _hasWorkspacesConfiguredViaPkgJson.apply(this, arguments);
}

function hasWorkspacesConfiguredViaLerna(_x3) {
  return _hasWorkspacesConfiguredViaLerna.apply(this, arguments);
}

function _hasWorkspacesConfiguredViaLerna() {
  _hasWorkspacesConfiguredViaLerna = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee2(directory) {
    var lernaJson;
    return _regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.prev = 0;
            _context2.next = 3;
            return fs.readJson(path.join(directory, "lerna.json"));

          case 3:
            lernaJson = _context2.sent;

            if (!(lernaJson.useWorkspaces !== true)) {
              _context2.next = 6;
              break;
            }

            return _context2.abrupt("return", directory);

          case 6:
            _context2.next = 12;
            break;

          case 8:
            _context2.prev = 8;
            _context2.t0 = _context2["catch"](0);

            if (!(_context2.t0.code !== "ENOENT")) {
              _context2.next = 12;
              break;
            }

            throw _context2.t0;

          case 12:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, null, [[0, 8]]);
  }));
  return _hasWorkspacesConfiguredViaLerna.apply(this, arguments);
}

function hasWorkspacesConfiguredViaPnpm(_x4) {
  return _hasWorkspacesConfiguredViaPnpm.apply(this, arguments);
}

function _hasWorkspacesConfiguredViaPnpm() {
  _hasWorkspacesConfiguredViaPnpm = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee3(directory) {
    var pnpmWorkspacesFileExists;
    return _regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return fs.exists(path.join(directory, "pnpm-workspace.yaml"));

          case 2:
            pnpmWorkspacesFileExists = _context3.sent;

            if (!pnpmWorkspacesFileExists) {
              _context3.next = 5;
              break;
            }

            return _context3.abrupt("return", directory);

          case 5:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3);
  }));
  return _hasWorkspacesConfiguredViaPnpm.apply(this, arguments);
}

function findRoot(_x5) {
  return _findRoot.apply(this, arguments);
}

function _findRoot() {
  _findRoot = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee4(cwd) {
    var firstPkgJsonDirRef, dir;
    return _regeneratorRuntime.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            firstPkgJsonDirRef = {
              current: undefined
            };
            _context4.next = 3;
            return findUp(function (directory) {
              return Promise.all([hasWorkspacesConfiguredViaLerna(directory), hasWorkspacesConfiguredViaPkgJson(directory, firstPkgJsonDirRef), hasWorkspacesConfiguredViaPnpm(directory)]).then(function (x) {
                return x.find(function (dir) {
                  return dir;
                });
              });
            }, {
              cwd: cwd,
              type: "directory"
            });

          case 3:
            dir = _context4.sent;

            if (!(firstPkgJsonDirRef.current === undefined)) {
              _context4.next = 6;
              break;
            }

            throw new NoPkgJsonFound(cwd);

          case 6:
            if (!(dir === undefined)) {
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
      }
    }, _callee4);
  }));
  return _findRoot.apply(this, arguments);
}

function hasWorkspacesConfiguredViaPkgJsonSync(directory, firstPkgJsonDirRef) {
  try {
    var pkgJson = fs.readJsonSync(path.join(directory, "package.json"));

    if (firstPkgJsonDirRef.current === undefined) {
      firstPkgJsonDirRef.current = directory;
    }

    if (pkgJson.workspaces || pkgJson.bolt) {
      return directory;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

function hasWorkspacesConfiguredViaLernaSync(directory) {
  try {
    var lernaJson = fs.readJsonSync(path.join(directory, "lerna.json"));

    if (lernaJson.useWorkspaces !== true) {
      return directory;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

function hasWorkspacesConfiguredViaPnpmSync(directory) {
  // @ts-ignore
  var pnpmWorkspacesFileExists = fs.existsSync(path.join(directory, "pnpm-workspace.yaml"));

  if (pnpmWorkspacesFileExists) {
    return directory;
  }
}

function findRootSync(cwd) {
  var firstPkgJsonDirRef = {
    current: undefined
  };
  var dir = sync(function (directory) {
    return [hasWorkspacesConfiguredViaLernaSync(directory), hasWorkspacesConfiguredViaPkgJsonSync(directory, firstPkgJsonDirRef), hasWorkspacesConfiguredViaPnpmSync(directory)].find(function (dir) {
      return dir;
    });
  }, {
    cwd: cwd,
    type: "directory"
  });

  if (firstPkgJsonDirRef.current === undefined) {
    throw new NoPkgJsonFound(cwd);
  }

  if (dir === undefined) {
    return firstPkgJsonDirRef.current;
  }

  return dir;
}

export { NoPkgJsonFound, findRoot, findRootSync };
