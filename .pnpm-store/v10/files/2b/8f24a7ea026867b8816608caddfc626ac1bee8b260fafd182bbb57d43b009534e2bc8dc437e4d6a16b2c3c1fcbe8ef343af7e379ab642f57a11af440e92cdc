"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "BulkLoad", {
  enumerable: true,
  get: function () {
    return _bulkLoad.default;
  }
});
Object.defineProperty(exports, "Connection", {
  enumerable: true,
  get: function () {
    return _connection.default;
  }
});
Object.defineProperty(exports, "ConnectionError", {
  enumerable: true,
  get: function () {
    return _errors.ConnectionError;
  }
});
Object.defineProperty(exports, "ISOLATION_LEVEL", {
  enumerable: true,
  get: function () {
    return _transaction.ISOLATION_LEVEL;
  }
});
Object.defineProperty(exports, "Request", {
  enumerable: true,
  get: function () {
    return _request.default;
  }
});
Object.defineProperty(exports, "RequestError", {
  enumerable: true,
  get: function () {
    return _errors.RequestError;
  }
});
Object.defineProperty(exports, "TDS_VERSION", {
  enumerable: true,
  get: function () {
    return _tdsVersions.versions;
  }
});
Object.defineProperty(exports, "TYPES", {
  enumerable: true,
  get: function () {
    return _dataType.TYPES;
  }
});
exports.connect = connect;
exports.library = void 0;
var _bulkLoad = _interopRequireDefault(require("./bulk-load"));
var _connection = _interopRequireDefault(require("./connection"));
var _request = _interopRequireDefault(require("./request"));
var _library = require("./library");
var _errors = require("./errors");
var _dataType = require("./data-type");
var _transaction = require("./transaction");
var _tdsVersions = require("./tds-versions");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const library = exports.library = {
  name: _library.name
};
function connect(config, connectListener) {
  const connection = new _connection.default(config);
  connection.connect(connectListener);
  return connection;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfYnVsa0xvYWQiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwicmVxdWlyZSIsIl9jb25uZWN0aW9uIiwiX3JlcXVlc3QiLCJfbGlicmFyeSIsIl9lcnJvcnMiLCJfZGF0YVR5cGUiLCJfdHJhbnNhY3Rpb24iLCJfdGRzVmVyc2lvbnMiLCJvYmoiLCJfX2VzTW9kdWxlIiwiZGVmYXVsdCIsImxpYnJhcnkiLCJleHBvcnRzIiwibmFtZSIsImNvbm5lY3QiLCJjb25maWciLCJjb25uZWN0TGlzdGVuZXIiLCJjb25uZWN0aW9uIiwiQ29ubmVjdGlvbiJdLCJzb3VyY2VzIjpbIi4uL3NyYy90ZWRpb3VzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCdWxrTG9hZCBmcm9tICcuL2J1bGstbG9hZCc7XG5pbXBvcnQgQ29ubmVjdGlvbiwgeyB0eXBlIENvbm5lY3Rpb25BdXRoZW50aWNhdGlvbiwgdHlwZSBDb25uZWN0aW9uQ29uZmlndXJhdGlvbiwgdHlwZSBDb25uZWN0aW9uT3B0aW9ucyB9IGZyb20gJy4vY29ubmVjdGlvbic7XG5pbXBvcnQgUmVxdWVzdCBmcm9tICcuL3JlcXVlc3QnO1xuaW1wb3J0IHsgbmFtZSB9IGZyb20gJy4vbGlicmFyeSc7XG5cbmltcG9ydCB7IENvbm5lY3Rpb25FcnJvciwgUmVxdWVzdEVycm9yIH0gZnJvbSAnLi9lcnJvcnMnO1xuXG5pbXBvcnQgeyBUWVBFUyB9IGZyb20gJy4vZGF0YS10eXBlJztcbmltcG9ydCB7IElTT0xBVElPTl9MRVZFTCB9IGZyb20gJy4vdHJhbnNhY3Rpb24nO1xuaW1wb3J0IHsgdmVyc2lvbnMgYXMgVERTX1ZFUlNJT04gfSBmcm9tICcuL3Rkcy12ZXJzaW9ucyc7XG5cbmNvbnN0IGxpYnJhcnkgPSB7IG5hbWU6IG5hbWUgfTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbm5lY3QoY29uZmlnOiBDb25uZWN0aW9uQ29uZmlndXJhdGlvbiwgY29ubmVjdExpc3RlbmVyPzogKGVycj86IEVycm9yKSA9PiB2b2lkKSB7XG4gIGNvbnN0IGNvbm5lY3Rpb24gPSBuZXcgQ29ubmVjdGlvbihjb25maWcpO1xuICBjb25uZWN0aW9uLmNvbm5lY3QoY29ubmVjdExpc3RlbmVyKTtcbiAgcmV0dXJuIGNvbm5lY3Rpb247XG59XG5cbmV4cG9ydCB7XG4gIEJ1bGtMb2FkLFxuICBDb25uZWN0aW9uLFxuICBSZXF1ZXN0LFxuICBsaWJyYXJ5LFxuICBDb25uZWN0aW9uRXJyb3IsXG4gIFJlcXVlc3RFcnJvcixcbiAgVFlQRVMsXG4gIElTT0xBVElPTl9MRVZFTCxcbiAgVERTX1ZFUlNJT05cbn07XG5cbmV4cG9ydCB0eXBlIHtcbiAgQ29ubmVjdGlvbkF1dGhlbnRpY2F0aW9uLFxuICBDb25uZWN0aW9uQ29uZmlndXJhdGlvbixcbiAgQ29ubmVjdGlvbk9wdGlvbnNcbn07XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFBQSxTQUFBLEdBQUFDLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBQyxXQUFBLEdBQUFGLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBRSxRQUFBLEdBQUFILHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBRyxRQUFBLEdBQUFILE9BQUE7QUFFQSxJQUFBSSxPQUFBLEdBQUFKLE9BQUE7QUFFQSxJQUFBSyxTQUFBLEdBQUFMLE9BQUE7QUFDQSxJQUFBTSxZQUFBLEdBQUFOLE9BQUE7QUFDQSxJQUFBTyxZQUFBLEdBQUFQLE9BQUE7QUFBeUQsU0FBQUQsdUJBQUFTLEdBQUEsV0FBQUEsR0FBQSxJQUFBQSxHQUFBLENBQUFDLFVBQUEsR0FBQUQsR0FBQSxLQUFBRSxPQUFBLEVBQUFGLEdBQUE7QUFFekQsTUFBTUcsT0FBTyxHQUFBQyxPQUFBLENBQUFELE9BQUEsR0FBRztFQUFFRSxJQUFJLEVBQUVBO0FBQUssQ0FBQztBQUV2QixTQUFTQyxPQUFPQSxDQUFDQyxNQUErQixFQUFFQyxlQUF1QyxFQUFFO0VBQ2hHLE1BQU1DLFVBQVUsR0FBRyxJQUFJQyxtQkFBVSxDQUFDSCxNQUFNLENBQUM7RUFDekNFLFVBQVUsQ0FBQ0gsT0FBTyxDQUFDRSxlQUFlLENBQUM7RUFDbkMsT0FBT0MsVUFBVTtBQUNuQiJ9