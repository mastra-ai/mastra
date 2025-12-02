"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _crypto = _interopRequireDefault(require("crypto"));
var _os = _interopRequireDefault(require("os"));
var tls = _interopRequireWildcard(require("tls"));
var net = _interopRequireWildcard(require("net"));
var _dns = _interopRequireDefault(require("dns"));
var _constants = _interopRequireDefault(require("constants"));
var _stream = require("stream");
var _identity = require("@azure/identity");
var _coreAuth = require("@azure/core-auth");
var _bulkLoad = _interopRequireDefault(require("./bulk-load"));
var _debug = _interopRequireDefault(require("./debug"));
var _events = require("events");
var _instanceLookup = require("./instance-lookup");
var _transientErrorLookup = require("./transient-error-lookup");
var _packet = require("./packet");
var _preloginPayload = _interopRequireDefault(require("./prelogin-payload"));
var _login7Payload = _interopRequireDefault(require("./login7-payload"));
var _ntlmPayload = _interopRequireDefault(require("./ntlm-payload"));
var _request = _interopRequireDefault(require("./request"));
var _rpcrequestPayload = _interopRequireDefault(require("./rpcrequest-payload"));
var _sqlbatchPayload = _interopRequireDefault(require("./sqlbatch-payload"));
var _messageIo = _interopRequireDefault(require("./message-io"));
var _tokenStreamParser = require("./token/token-stream-parser");
var _transaction = require("./transaction");
var _errors = require("./errors");
var _connector = require("./connector");
var _library = require("./library");
var _tdsVersions = require("./tds-versions");
var _message = _interopRequireDefault(require("./message"));
var _ntlm = require("./ntlm");
var _dataType = require("./data-type");
var _bulkLoadPayload = require("./bulk-load-payload");
var _specialStoredProcedure = _interopRequireDefault(require("./special-stored-procedure"));
var _package = require("../package.json");
var _url = require("url");
var _handler = require("./token/handler");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
// eslint-disable-next-line @typescript-eslint/no-unused-vars

/**
 * @private
 */
const KEEP_ALIVE_INITIAL_DELAY = 30 * 1000;
/**
 * @private
 */
const DEFAULT_CONNECT_TIMEOUT = 15 * 1000;
/**
 * @private
 */
const DEFAULT_CLIENT_REQUEST_TIMEOUT = 15 * 1000;
/**
 * @private
 */
const DEFAULT_CANCEL_TIMEOUT = 5 * 1000;
/**
 * @private
 */
const DEFAULT_CONNECT_RETRY_INTERVAL = 500;
/**
 * @private
 */
const DEFAULT_PACKET_SIZE = 4 * 1024;
/**
 * @private
 */
const DEFAULT_TEXTSIZE = 2147483647;
/**
 * @private
 */
const DEFAULT_DATEFIRST = 7;
/**
 * @private
 */
const DEFAULT_PORT = 1433;
/**
 * @private
 */
const DEFAULT_TDS_VERSION = '7_4';
/**
 * @private
 */
const DEFAULT_LANGUAGE = 'us_english';
/**
 * @private
 */
const DEFAULT_DATEFORMAT = 'mdy';

/** Structure that defines the options that are necessary to authenticate the Tedious.JS instance with an `@azure/identity` token credential. */

/**
 * @private
 */

/**
 * @private
 */
const CLEANUP_TYPE = {
  NORMAL: 0,
  REDIRECT: 1,
  RETRY: 2
};
/**
 * A [[Connection]] instance represents a single connection to a database server.
 *
 * ```js
 * var Connection = require('tedious').Connection;
 * var config = {
 *  "authentication": {
 *    ...,
 *    "options": {...}
 *  },
 *  "options": {...}
 * };
 * var connection = new Connection(config);
 * ```
 *
 * Only one request at a time may be executed on a connection. Once a [[Request]]
 * has been initiated (with [[Connection.callProcedure]], [[Connection.execSql]],
 * or [[Connection.execSqlBatch]]), another should not be initiated until the
 * [[Request]]'s completion callback is called.
 */
class Connection extends _events.EventEmitter {
  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */
  _cancelAfterRequestSent;

  /**
   * @private
   */

  /**
   * Note: be aware of the different options field:
   * 1. config.authentication.options
   * 2. config.options
   *
   * ```js
   * const { Connection } = require('tedious');
   *
   * const config = {
   *  "authentication": {
   *    ...,
   *    "options": {...}
   *  },
   *  "options": {...}
   * };
   *
   * const connection = new Connection(config);
   * ```
   *
   * @param config
   */
  constructor(config) {
    super();
    if (typeof config !== 'object' || config === null) {
      throw new TypeError('The "config" argument is required and must be of type Object.');
    }
    if (typeof config.server !== 'string') {
      throw new TypeError('The "config.server" property is required and must be of type string.');
    }
    this.fedAuthRequired = false;
    let authentication;
    if (config.authentication !== undefined) {
      if (typeof config.authentication !== 'object' || config.authentication === null) {
        throw new TypeError('The "config.authentication" property must be of type Object.');
      }
      const type = config.authentication.type;
      const options = config.authentication.options === undefined ? {} : config.authentication.options;
      if (typeof type !== 'string') {
        throw new TypeError('The "config.authentication.type" property must be of type string.');
      }
      if (type !== 'default' && type !== 'ntlm' && type !== 'token-credential' && type !== 'azure-active-directory-password' && type !== 'azure-active-directory-access-token' && type !== 'azure-active-directory-msi-vm' && type !== 'azure-active-directory-msi-app-service' && type !== 'azure-active-directory-service-principal-secret' && type !== 'azure-active-directory-default') {
        throw new TypeError('The "type" property must one of "default", "ntlm", "token-credential", "azure-active-directory-password", "azure-active-directory-access-token", "azure-active-directory-default", "azure-active-directory-msi-vm" or "azure-active-directory-msi-app-service" or "azure-active-directory-service-principal-secret".');
      }
      if (typeof options !== 'object' || options === null) {
        throw new TypeError('The "config.authentication.options" property must be of type object.');
      }
      if (type === 'ntlm') {
        if (typeof options.domain !== 'string') {
          throw new TypeError('The "config.authentication.options.domain" property must be of type string.');
        }
        if (options.userName !== undefined && typeof options.userName !== 'string') {
          throw new TypeError('The "config.authentication.options.userName" property must be of type string.');
        }
        if (options.password !== undefined && typeof options.password !== 'string') {
          throw new TypeError('The "config.authentication.options.password" property must be of type string.');
        }
        authentication = {
          type: 'ntlm',
          options: {
            userName: options.userName,
            password: options.password,
            domain: options.domain && options.domain.toUpperCase()
          }
        };
      } else if (type === 'token-credential') {
        if (!(0, _coreAuth.isTokenCredential)(options.credential)) {
          throw new TypeError('The "config.authentication.options.credential" property must be an instance of the token credential class.');
        }
        authentication = {
          type: 'token-credential',
          options: {
            credential: options.credential
          }
        };
      } else if (type === 'azure-active-directory-password') {
        if (typeof options.clientId !== 'string') {
          throw new TypeError('The "config.authentication.options.clientId" property must be of type string.');
        }
        if (options.userName !== undefined && typeof options.userName !== 'string') {
          throw new TypeError('The "config.authentication.options.userName" property must be of type string.');
        }
        if (options.password !== undefined && typeof options.password !== 'string') {
          throw new TypeError('The "config.authentication.options.password" property must be of type string.');
        }
        if (options.tenantId !== undefined && typeof options.tenantId !== 'string') {
          throw new TypeError('The "config.authentication.options.tenantId" property must be of type string.');
        }
        authentication = {
          type: 'azure-active-directory-password',
          options: {
            userName: options.userName,
            password: options.password,
            tenantId: options.tenantId,
            clientId: options.clientId
          }
        };
      } else if (type === 'azure-active-directory-access-token') {
        if (typeof options.token !== 'string') {
          throw new TypeError('The "config.authentication.options.token" property must be of type string.');
        }
        authentication = {
          type: 'azure-active-directory-access-token',
          options: {
            token: options.token
          }
        };
      } else if (type === 'azure-active-directory-msi-vm') {
        if (options.clientId !== undefined && typeof options.clientId !== 'string') {
          throw new TypeError('The "config.authentication.options.clientId" property must be of type string.');
        }
        authentication = {
          type: 'azure-active-directory-msi-vm',
          options: {
            clientId: options.clientId
          }
        };
      } else if (type === 'azure-active-directory-default') {
        if (options.clientId !== undefined && typeof options.clientId !== 'string') {
          throw new TypeError('The "config.authentication.options.clientId" property must be of type string.');
        }
        authentication = {
          type: 'azure-active-directory-default',
          options: {
            clientId: options.clientId
          }
        };
      } else if (type === 'azure-active-directory-msi-app-service') {
        if (options.clientId !== undefined && typeof options.clientId !== 'string') {
          throw new TypeError('The "config.authentication.options.clientId" property must be of type string.');
        }
        authentication = {
          type: 'azure-active-directory-msi-app-service',
          options: {
            clientId: options.clientId
          }
        };
      } else if (type === 'azure-active-directory-service-principal-secret') {
        if (typeof options.clientId !== 'string') {
          throw new TypeError('The "config.authentication.options.clientId" property must be of type string.');
        }
        if (typeof options.clientSecret !== 'string') {
          throw new TypeError('The "config.authentication.options.clientSecret" property must be of type string.');
        }
        if (typeof options.tenantId !== 'string') {
          throw new TypeError('The "config.authentication.options.tenantId" property must be of type string.');
        }
        authentication = {
          type: 'azure-active-directory-service-principal-secret',
          options: {
            clientId: options.clientId,
            clientSecret: options.clientSecret,
            tenantId: options.tenantId
          }
        };
      } else {
        if (options.userName !== undefined && typeof options.userName !== 'string') {
          throw new TypeError('The "config.authentication.options.userName" property must be of type string.');
        }
        if (options.password !== undefined && typeof options.password !== 'string') {
          throw new TypeError('The "config.authentication.options.password" property must be of type string.');
        }
        authentication = {
          type: 'default',
          options: {
            userName: options.userName,
            password: options.password
          }
        };
      }
    } else {
      authentication = {
        type: 'default',
        options: {
          userName: undefined,
          password: undefined
        }
      };
    }
    this.config = {
      server: config.server,
      authentication: authentication,
      options: {
        abortTransactionOnError: false,
        appName: undefined,
        camelCaseColumns: false,
        cancelTimeout: DEFAULT_CANCEL_TIMEOUT,
        columnEncryptionKeyCacheTTL: 2 * 60 * 60 * 1000,
        // Units: milliseconds
        columnEncryptionSetting: false,
        columnNameReplacer: undefined,
        connectionRetryInterval: DEFAULT_CONNECT_RETRY_INTERVAL,
        connectTimeout: DEFAULT_CONNECT_TIMEOUT,
        connector: undefined,
        connectionIsolationLevel: _transaction.ISOLATION_LEVEL.READ_COMMITTED,
        cryptoCredentialsDetails: {},
        database: undefined,
        datefirst: DEFAULT_DATEFIRST,
        dateFormat: DEFAULT_DATEFORMAT,
        debug: {
          data: false,
          packet: false,
          payload: false,
          token: false
        },
        enableAnsiNull: true,
        enableAnsiNullDefault: true,
        enableAnsiPadding: true,
        enableAnsiWarnings: true,
        enableArithAbort: true,
        enableConcatNullYieldsNull: true,
        enableCursorCloseOnCommit: null,
        enableImplicitTransactions: false,
        enableNumericRoundabort: false,
        enableQuotedIdentifier: true,
        encrypt: true,
        fallbackToDefaultDb: false,
        encryptionKeyStoreProviders: undefined,
        instanceName: undefined,
        isolationLevel: _transaction.ISOLATION_LEVEL.READ_COMMITTED,
        language: DEFAULT_LANGUAGE,
        localAddress: undefined,
        maxRetriesOnTransientErrors: 3,
        multiSubnetFailover: false,
        packetSize: DEFAULT_PACKET_SIZE,
        port: DEFAULT_PORT,
        readOnlyIntent: false,
        requestTimeout: DEFAULT_CLIENT_REQUEST_TIMEOUT,
        rowCollectionOnDone: false,
        rowCollectionOnRequestCompletion: false,
        serverName: undefined,
        serverSupportsColumnEncryption: false,
        tdsVersion: DEFAULT_TDS_VERSION,
        textsize: DEFAULT_TEXTSIZE,
        trustedServerNameAE: undefined,
        trustServerCertificate: false,
        useColumnNames: false,
        useUTC: true,
        workstationId: undefined,
        lowerCaseGuids: false
      }
    };
    if (config.options) {
      if (config.options.port && config.options.instanceName) {
        throw new Error('Port and instanceName are mutually exclusive, but ' + config.options.port + ' and ' + config.options.instanceName + ' provided');
      }
      if (config.options.abortTransactionOnError !== undefined) {
        if (typeof config.options.abortTransactionOnError !== 'boolean' && config.options.abortTransactionOnError !== null) {
          throw new TypeError('The "config.options.abortTransactionOnError" property must be of type string or null.');
        }
        this.config.options.abortTransactionOnError = config.options.abortTransactionOnError;
      }
      if (config.options.appName !== undefined) {
        if (typeof config.options.appName !== 'string') {
          throw new TypeError('The "config.options.appName" property must be of type string.');
        }
        this.config.options.appName = config.options.appName;
      }
      if (config.options.camelCaseColumns !== undefined) {
        if (typeof config.options.camelCaseColumns !== 'boolean') {
          throw new TypeError('The "config.options.camelCaseColumns" property must be of type boolean.');
        }
        this.config.options.camelCaseColumns = config.options.camelCaseColumns;
      }
      if (config.options.cancelTimeout !== undefined) {
        if (typeof config.options.cancelTimeout !== 'number') {
          throw new TypeError('The "config.options.cancelTimeout" property must be of type number.');
        }
        this.config.options.cancelTimeout = config.options.cancelTimeout;
      }
      if (config.options.columnNameReplacer) {
        if (typeof config.options.columnNameReplacer !== 'function') {
          throw new TypeError('The "config.options.cancelTimeout" property must be of type function.');
        }
        this.config.options.columnNameReplacer = config.options.columnNameReplacer;
      }
      if (config.options.connectionIsolationLevel !== undefined) {
        (0, _transaction.assertValidIsolationLevel)(config.options.connectionIsolationLevel, 'config.options.connectionIsolationLevel');
        this.config.options.connectionIsolationLevel = config.options.connectionIsolationLevel;
      }
      if (config.options.connectTimeout !== undefined) {
        if (typeof config.options.connectTimeout !== 'number') {
          throw new TypeError('The "config.options.connectTimeout" property must be of type number.');
        }
        this.config.options.connectTimeout = config.options.connectTimeout;
      }
      if (config.options.connector !== undefined) {
        if (typeof config.options.connector !== 'function') {
          throw new TypeError('The "config.options.connector" property must be a function.');
        }
        this.config.options.connector = config.options.connector;
      }
      if (config.options.cryptoCredentialsDetails !== undefined) {
        if (typeof config.options.cryptoCredentialsDetails !== 'object' || config.options.cryptoCredentialsDetails === null) {
          throw new TypeError('The "config.options.cryptoCredentialsDetails" property must be of type Object.');
        }
        this.config.options.cryptoCredentialsDetails = config.options.cryptoCredentialsDetails;
      }
      if (config.options.database !== undefined) {
        if (typeof config.options.database !== 'string') {
          throw new TypeError('The "config.options.database" property must be of type string.');
        }
        this.config.options.database = config.options.database;
      }
      if (config.options.datefirst !== undefined) {
        if (typeof config.options.datefirst !== 'number' && config.options.datefirst !== null) {
          throw new TypeError('The "config.options.datefirst" property must be of type number.');
        }
        if (config.options.datefirst !== null && (config.options.datefirst < 1 || config.options.datefirst > 7)) {
          throw new RangeError('The "config.options.datefirst" property must be >= 1 and <= 7');
        }
        this.config.options.datefirst = config.options.datefirst;
      }
      if (config.options.dateFormat !== undefined) {
        if (typeof config.options.dateFormat !== 'string' && config.options.dateFormat !== null) {
          throw new TypeError('The "config.options.dateFormat" property must be of type string or null.');
        }
        this.config.options.dateFormat = config.options.dateFormat;
      }
      if (config.options.debug) {
        if (config.options.debug.data !== undefined) {
          if (typeof config.options.debug.data !== 'boolean') {
            throw new TypeError('The "config.options.debug.data" property must be of type boolean.');
          }
          this.config.options.debug.data = config.options.debug.data;
        }
        if (config.options.debug.packet !== undefined) {
          if (typeof config.options.debug.packet !== 'boolean') {
            throw new TypeError('The "config.options.debug.packet" property must be of type boolean.');
          }
          this.config.options.debug.packet = config.options.debug.packet;
        }
        if (config.options.debug.payload !== undefined) {
          if (typeof config.options.debug.payload !== 'boolean') {
            throw new TypeError('The "config.options.debug.payload" property must be of type boolean.');
          }
          this.config.options.debug.payload = config.options.debug.payload;
        }
        if (config.options.debug.token !== undefined) {
          if (typeof config.options.debug.token !== 'boolean') {
            throw new TypeError('The "config.options.debug.token" property must be of type boolean.');
          }
          this.config.options.debug.token = config.options.debug.token;
        }
      }
      if (config.options.enableAnsiNull !== undefined) {
        if (typeof config.options.enableAnsiNull !== 'boolean' && config.options.enableAnsiNull !== null) {
          throw new TypeError('The "config.options.enableAnsiNull" property must be of type boolean or null.');
        }
        this.config.options.enableAnsiNull = config.options.enableAnsiNull;
      }
      if (config.options.enableAnsiNullDefault !== undefined) {
        if (typeof config.options.enableAnsiNullDefault !== 'boolean' && config.options.enableAnsiNullDefault !== null) {
          throw new TypeError('The "config.options.enableAnsiNullDefault" property must be of type boolean or null.');
        }
        this.config.options.enableAnsiNullDefault = config.options.enableAnsiNullDefault;
      }
      if (config.options.enableAnsiPadding !== undefined) {
        if (typeof config.options.enableAnsiPadding !== 'boolean' && config.options.enableAnsiPadding !== null) {
          throw new TypeError('The "config.options.enableAnsiPadding" property must be of type boolean or null.');
        }
        this.config.options.enableAnsiPadding = config.options.enableAnsiPadding;
      }
      if (config.options.enableAnsiWarnings !== undefined) {
        if (typeof config.options.enableAnsiWarnings !== 'boolean' && config.options.enableAnsiWarnings !== null) {
          throw new TypeError('The "config.options.enableAnsiWarnings" property must be of type boolean or null.');
        }
        this.config.options.enableAnsiWarnings = config.options.enableAnsiWarnings;
      }
      if (config.options.enableArithAbort !== undefined) {
        if (typeof config.options.enableArithAbort !== 'boolean' && config.options.enableArithAbort !== null) {
          throw new TypeError('The "config.options.enableArithAbort" property must be of type boolean or null.');
        }
        this.config.options.enableArithAbort = config.options.enableArithAbort;
      }
      if (config.options.enableConcatNullYieldsNull !== undefined) {
        if (typeof config.options.enableConcatNullYieldsNull !== 'boolean' && config.options.enableConcatNullYieldsNull !== null) {
          throw new TypeError('The "config.options.enableConcatNullYieldsNull" property must be of type boolean or null.');
        }
        this.config.options.enableConcatNullYieldsNull = config.options.enableConcatNullYieldsNull;
      }
      if (config.options.enableCursorCloseOnCommit !== undefined) {
        if (typeof config.options.enableCursorCloseOnCommit !== 'boolean' && config.options.enableCursorCloseOnCommit !== null) {
          throw new TypeError('The "config.options.enableCursorCloseOnCommit" property must be of type boolean or null.');
        }
        this.config.options.enableCursorCloseOnCommit = config.options.enableCursorCloseOnCommit;
      }
      if (config.options.enableImplicitTransactions !== undefined) {
        if (typeof config.options.enableImplicitTransactions !== 'boolean' && config.options.enableImplicitTransactions !== null) {
          throw new TypeError('The "config.options.enableImplicitTransactions" property must be of type boolean or null.');
        }
        this.config.options.enableImplicitTransactions = config.options.enableImplicitTransactions;
      }
      if (config.options.enableNumericRoundabort !== undefined) {
        if (typeof config.options.enableNumericRoundabort !== 'boolean' && config.options.enableNumericRoundabort !== null) {
          throw new TypeError('The "config.options.enableNumericRoundabort" property must be of type boolean or null.');
        }
        this.config.options.enableNumericRoundabort = config.options.enableNumericRoundabort;
      }
      if (config.options.enableQuotedIdentifier !== undefined) {
        if (typeof config.options.enableQuotedIdentifier !== 'boolean' && config.options.enableQuotedIdentifier !== null) {
          throw new TypeError('The "config.options.enableQuotedIdentifier" property must be of type boolean or null.');
        }
        this.config.options.enableQuotedIdentifier = config.options.enableQuotedIdentifier;
      }
      if (config.options.encrypt !== undefined) {
        if (typeof config.options.encrypt !== 'boolean') {
          if (config.options.encrypt !== 'strict') {
            throw new TypeError('The "encrypt" property must be set to "strict", or of type boolean.');
          }
        }
        this.config.options.encrypt = config.options.encrypt;
      }
      if (config.options.fallbackToDefaultDb !== undefined) {
        if (typeof config.options.fallbackToDefaultDb !== 'boolean') {
          throw new TypeError('The "config.options.fallbackToDefaultDb" property must be of type boolean.');
        }
        this.config.options.fallbackToDefaultDb = config.options.fallbackToDefaultDb;
      }
      if (config.options.instanceName !== undefined) {
        if (typeof config.options.instanceName !== 'string') {
          throw new TypeError('The "config.options.instanceName" property must be of type string.');
        }
        this.config.options.instanceName = config.options.instanceName;
        this.config.options.port = undefined;
      }
      if (config.options.isolationLevel !== undefined) {
        (0, _transaction.assertValidIsolationLevel)(config.options.isolationLevel, 'config.options.isolationLevel');
        this.config.options.isolationLevel = config.options.isolationLevel;
      }
      if (config.options.language !== undefined) {
        if (typeof config.options.language !== 'string' && config.options.language !== null) {
          throw new TypeError('The "config.options.language" property must be of type string or null.');
        }
        this.config.options.language = config.options.language;
      }
      if (config.options.localAddress !== undefined) {
        if (typeof config.options.localAddress !== 'string') {
          throw new TypeError('The "config.options.localAddress" property must be of type string.');
        }
        this.config.options.localAddress = config.options.localAddress;
      }
      if (config.options.multiSubnetFailover !== undefined) {
        if (typeof config.options.multiSubnetFailover !== 'boolean') {
          throw new TypeError('The "config.options.multiSubnetFailover" property must be of type boolean.');
        }
        this.config.options.multiSubnetFailover = config.options.multiSubnetFailover;
      }
      if (config.options.packetSize !== undefined) {
        if (typeof config.options.packetSize !== 'number') {
          throw new TypeError('The "config.options.packetSize" property must be of type number.');
        }
        this.config.options.packetSize = config.options.packetSize;
      }
      if (config.options.port !== undefined) {
        if (typeof config.options.port !== 'number') {
          throw new TypeError('The "config.options.port" property must be of type number.');
        }
        if (config.options.port <= 0 || config.options.port >= 65536) {
          throw new RangeError('The "config.options.port" property must be > 0 and < 65536');
        }
        this.config.options.port = config.options.port;
        this.config.options.instanceName = undefined;
      }
      if (config.options.readOnlyIntent !== undefined) {
        if (typeof config.options.readOnlyIntent !== 'boolean') {
          throw new TypeError('The "config.options.readOnlyIntent" property must be of type boolean.');
        }
        this.config.options.readOnlyIntent = config.options.readOnlyIntent;
      }
      if (config.options.requestTimeout !== undefined) {
        if (typeof config.options.requestTimeout !== 'number') {
          throw new TypeError('The "config.options.requestTimeout" property must be of type number.');
        }
        this.config.options.requestTimeout = config.options.requestTimeout;
      }
      if (config.options.maxRetriesOnTransientErrors !== undefined) {
        if (typeof config.options.maxRetriesOnTransientErrors !== 'number') {
          throw new TypeError('The "config.options.maxRetriesOnTransientErrors" property must be of type number.');
        }
        if (config.options.maxRetriesOnTransientErrors < 0) {
          throw new TypeError('The "config.options.maxRetriesOnTransientErrors" property must be equal or greater than 0.');
        }
        this.config.options.maxRetriesOnTransientErrors = config.options.maxRetriesOnTransientErrors;
      }
      if (config.options.connectionRetryInterval !== undefined) {
        if (typeof config.options.connectionRetryInterval !== 'number') {
          throw new TypeError('The "config.options.connectionRetryInterval" property must be of type number.');
        }
        if (config.options.connectionRetryInterval <= 0) {
          throw new TypeError('The "config.options.connectionRetryInterval" property must be greater than 0.');
        }
        this.config.options.connectionRetryInterval = config.options.connectionRetryInterval;
      }
      if (config.options.rowCollectionOnDone !== undefined) {
        if (typeof config.options.rowCollectionOnDone !== 'boolean') {
          throw new TypeError('The "config.options.rowCollectionOnDone" property must be of type boolean.');
        }
        this.config.options.rowCollectionOnDone = config.options.rowCollectionOnDone;
      }
      if (config.options.rowCollectionOnRequestCompletion !== undefined) {
        if (typeof config.options.rowCollectionOnRequestCompletion !== 'boolean') {
          throw new TypeError('The "config.options.rowCollectionOnRequestCompletion" property must be of type boolean.');
        }
        this.config.options.rowCollectionOnRequestCompletion = config.options.rowCollectionOnRequestCompletion;
      }
      if (config.options.tdsVersion !== undefined) {
        if (typeof config.options.tdsVersion !== 'string') {
          throw new TypeError('The "config.options.tdsVersion" property must be of type string.');
        }
        this.config.options.tdsVersion = config.options.tdsVersion;
      }
      if (config.options.textsize !== undefined) {
        if (typeof config.options.textsize !== 'number' && config.options.textsize !== null) {
          throw new TypeError('The "config.options.textsize" property must be of type number or null.');
        }
        if (config.options.textsize > 2147483647) {
          throw new TypeError('The "config.options.textsize" can\'t be greater than 2147483647.');
        } else if (config.options.textsize < -1) {
          throw new TypeError('The "config.options.textsize" can\'t be smaller than -1.');
        }
        this.config.options.textsize = config.options.textsize | 0;
      }
      if (config.options.trustServerCertificate !== undefined) {
        if (typeof config.options.trustServerCertificate !== 'boolean') {
          throw new TypeError('The "config.options.trustServerCertificate" property must be of type boolean.');
        }
        this.config.options.trustServerCertificate = config.options.trustServerCertificate;
      }
      if (config.options.serverName !== undefined) {
        if (typeof config.options.serverName !== 'string') {
          throw new TypeError('The "config.options.serverName" property must be of type string.');
        }
        this.config.options.serverName = config.options.serverName;
      }
      if (config.options.useColumnNames !== undefined) {
        if (typeof config.options.useColumnNames !== 'boolean') {
          throw new TypeError('The "config.options.useColumnNames" property must be of type boolean.');
        }
        this.config.options.useColumnNames = config.options.useColumnNames;
      }
      if (config.options.useUTC !== undefined) {
        if (typeof config.options.useUTC !== 'boolean') {
          throw new TypeError('The "config.options.useUTC" property must be of type boolean.');
        }
        this.config.options.useUTC = config.options.useUTC;
      }
      if (config.options.workstationId !== undefined) {
        if (typeof config.options.workstationId !== 'string') {
          throw new TypeError('The "config.options.workstationId" property must be of type string.');
        }
        this.config.options.workstationId = config.options.workstationId;
      }
      if (config.options.lowerCaseGuids !== undefined) {
        if (typeof config.options.lowerCaseGuids !== 'boolean') {
          throw new TypeError('The "config.options.lowerCaseGuids" property must be of type boolean.');
        }
        this.config.options.lowerCaseGuids = config.options.lowerCaseGuids;
      }
    }
    this.secureContextOptions = this.config.options.cryptoCredentialsDetails;
    if (this.secureContextOptions.secureOptions === undefined) {
      // If the caller has not specified their own `secureOptions`,
      // we set `SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS` here.
      // Older SQL Server instances running on older Windows versions have
      // trouble with the BEAST workaround in OpenSSL.
      // As BEAST is a browser specific exploit, we can just disable this option here.
      this.secureContextOptions = Object.create(this.secureContextOptions, {
        secureOptions: {
          value: _constants.default.SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS
        }
      });
    }
    this.debug = this.createDebug();
    this.inTransaction = false;
    this.transactionDescriptors = [Buffer.from([0, 0, 0, 0, 0, 0, 0, 0])];

    // 'beginTransaction', 'commitTransaction' and 'rollbackTransaction'
    // events are utilized to maintain inTransaction property state which in
    // turn is used in managing transactions. These events are only fired for
    // TDS version 7.2 and beyond. The properties below are used to emulate
    // equivalent behavior for TDS versions before 7.2.
    this.transactionDepth = 0;
    this.isSqlBatch = false;
    this.closed = false;
    this.messageBuffer = Buffer.alloc(0);
    this.curTransientRetryCount = 0;
    this.transientErrorLookup = new _transientErrorLookup.TransientErrorLookup();
    this.state = this.STATE.INITIALIZED;
    this._cancelAfterRequestSent = () => {
      this.messageIo.sendMessage(_packet.TYPE.ATTENTION);
      this.createCancelTimer();
    };
  }
  connect(connectListener) {
    if (this.state !== this.STATE.INITIALIZED) {
      throw new _errors.ConnectionError('`.connect` can not be called on a Connection in `' + this.state.name + '` state.');
    }
    if (connectListener) {
      const onConnect = err => {
        this.removeListener('error', onError);
        connectListener(err);
      };
      const onError = err => {
        this.removeListener('connect', onConnect);
        connectListener(err);
      };
      this.once('connect', onConnect);
      this.once('error', onError);
    }
    this.transitionTo(this.STATE.CONNECTING);
  }

  /**
   * The server has reported that the charset has changed.
   */

  /**
   * The attempt to connect and validate has completed.
   */

  /**
   * The server has reported that the active database has changed.
   * This may be as a result of a successful login, or a `use` statement.
   */

  /**
   * A debug message is available. It may be logged or ignored.
   */

  /**
   * Internal error occurs.
   */

  /**
   * The server has issued an error message.
   */

  /**
   * The connection has ended.
   *
   * This may be as a result of the client calling [[close]], the server
   * closing the connection, or a network error.
   */

  /**
   * The server has issued an information message.
   */

  /**
   * The server has reported that the language has changed.
   */

  /**
   * The connection was reset.
   */

  /**
   * A secure connection has been established.
   */

  on(event, listener) {
    return super.on(event, listener);
  }

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  /**
   * @private
   */

  emit(event, ...args) {
    return super.emit(event, ...args);
  }

  /**
   * Closes the connection to the database.
   *
   * The [[Event_end]] will be emitted once the connection has been closed.
   */
  close() {
    this.transitionTo(this.STATE.FINAL);
  }

  /**
   * @private
   */
  initialiseConnection() {
    const signal = this.createConnectTimer();
    if (this.config.options.port) {
      return this.connectOnPort(this.config.options.port, this.config.options.multiSubnetFailover, signal, this.config.options.connector);
    } else {
      return (0, _instanceLookup.instanceLookup)({
        server: this.config.server,
        instanceName: this.config.options.instanceName,
        timeout: this.config.options.connectTimeout,
        signal: signal
      }).then(port => {
        process.nextTick(() => {
          this.connectOnPort(port, this.config.options.multiSubnetFailover, signal, this.config.options.connector);
        });
      }, err => {
        this.clearConnectTimer();
        if (signal.aborted) {
          // Ignore the AbortError for now, this is still handled by the connectTimer firing
          return;
        }
        process.nextTick(() => {
          this.emit('connect', new _errors.ConnectionError(err.message, 'EINSTLOOKUP', {
            cause: err
          }));
        });
      });
    }
  }

  /**
   * @private
   */
  cleanupConnection(cleanupType) {
    if (!this.closed) {
      this.clearConnectTimer();
      this.clearRequestTimer();
      this.clearRetryTimer();
      this.closeConnection();
      if (cleanupType === CLEANUP_TYPE.REDIRECT) {
        this.emit('rerouting');
      } else if (cleanupType !== CLEANUP_TYPE.RETRY) {
        process.nextTick(() => {
          this.emit('end');
        });
      }
      const request = this.request;
      if (request) {
        const err = new _errors.RequestError('Connection closed before request completed.', 'ECLOSE');
        request.callback(err);
        this.request = undefined;
      }
      this.closed = true;
      this.loginError = undefined;
    }
  }

  /**
   * @private
   */
  createDebug() {
    const debug = new _debug.default(this.config.options.debug);
    debug.on('debug', message => {
      this.emit('debug', message);
    });
    return debug;
  }

  /**
   * @private
   */
  createTokenStreamParser(message, handler) {
    return new _tokenStreamParser.Parser(message, this.debug, handler, this.config.options);
  }
  socketHandlingForSendPreLogin(socket) {
    socket.on('error', error => {
      this.socketError(error);
    });
    socket.on('close', () => {
      this.socketClose();
    });
    socket.on('end', () => {
      this.socketEnd();
    });
    socket.setKeepAlive(true, KEEP_ALIVE_INITIAL_DELAY);
    this.messageIo = new _messageIo.default(socket, this.config.options.packetSize, this.debug);
    this.messageIo.on('secure', cleartext => {
      this.emit('secure', cleartext);
    });
    this.socket = socket;
    this.closed = false;
    this.debug.log('connected to ' + this.config.server + ':' + this.config.options.port);
    this.sendPreLogin();
    this.transitionTo(this.STATE.SENT_PRELOGIN);
  }
  wrapWithTls(socket, signal) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const secureContext = tls.createSecureContext(this.secureContextOptions);
      // If connect to an ip address directly,
      // need to set the servername to an empty string
      // if the user has not given a servername explicitly
      const serverName = !net.isIP(this.config.server) ? this.config.server : '';
      const encryptOptions = {
        host: this.config.server,
        socket: socket,
        ALPNProtocols: ['tds/8.0'],
        secureContext: secureContext,
        servername: this.config.options.serverName ? this.config.options.serverName : serverName
      };
      const encryptsocket = tls.connect(encryptOptions);
      const onAbort = () => {
        encryptsocket.removeListener('error', onError);
        encryptsocket.removeListener('connect', onConnect);
        encryptsocket.destroy();
        reject(signal.reason);
      };
      const onError = err => {
        signal.removeEventListener('abort', onAbort);
        encryptsocket.removeListener('error', onError);
        encryptsocket.removeListener('connect', onConnect);
        encryptsocket.destroy();
        reject(err);
      };
      const onConnect = () => {
        signal.removeEventListener('abort', onAbort);
        encryptsocket.removeListener('error', onError);
        encryptsocket.removeListener('connect', onConnect);
        resolve(encryptsocket);
      };
      signal.addEventListener('abort', onAbort, {
        once: true
      });
      encryptsocket.on('error', onError);
      encryptsocket.on('secureConnect', onConnect);
    });
  }
  connectOnPort(port, multiSubnetFailover, signal, customConnector) {
    const connectOpts = {
      host: this.routingData ? this.routingData.server : this.config.server,
      port: this.routingData ? this.routingData.port : port,
      localAddress: this.config.options.localAddress
    };
    const connect = customConnector || (multiSubnetFailover ? _connector.connectInParallel : _connector.connectInSequence);
    (async () => {
      let socket = await connect(connectOpts, _dns.default.lookup, signal);
      if (this.config.options.encrypt === 'strict') {
        try {
          // Wrap the socket with TLS for TDS 8.0
          socket = await this.wrapWithTls(socket, signal);
        } catch (err) {
          socket.end();
          throw err;
        }
      }
      this.socketHandlingForSendPreLogin(socket);
    })().catch(err => {
      this.clearConnectTimer();
      if (signal.aborted) {
        return;
      }
      process.nextTick(() => {
        this.socketError(err);
      });
    });
  }

  /**
   * @private
   */
  closeConnection() {
    if (this.socket) {
      this.socket.destroy();
    }
  }

  /**
   * @private
   */
  createConnectTimer() {
    const controller = new AbortController();
    this.connectTimer = setTimeout(() => {
      controller.abort();
      this.connectTimeout();
    }, this.config.options.connectTimeout);
    return controller.signal;
  }

  /**
   * @private
   */
  createCancelTimer() {
    this.clearCancelTimer();
    const timeout = this.config.options.cancelTimeout;
    if (timeout > 0) {
      this.cancelTimer = setTimeout(() => {
        this.cancelTimeout();
      }, timeout);
    }
  }

  /**
   * @private
   */
  createRequestTimer() {
    this.clearRequestTimer(); // release old timer, just to be safe
    const request = this.request;
    const timeout = request.timeout !== undefined ? request.timeout : this.config.options.requestTimeout;
    if (timeout) {
      this.requestTimer = setTimeout(() => {
        this.requestTimeout();
      }, timeout);
    }
  }

  /**
   * @private
   */
  createRetryTimer() {
    this.clearRetryTimer();
    this.retryTimer = setTimeout(() => {
      this.retryTimeout();
    }, this.config.options.connectionRetryInterval);
  }

  /**
   * @private
   */
  connectTimeout() {
    const hostPostfix = this.config.options.port ? `:${this.config.options.port}` : `\\${this.config.options.instanceName}`;
    // If we have routing data stored, this connection has been redirected
    const server = this.routingData ? this.routingData.server : this.config.server;
    const port = this.routingData ? `:${this.routingData.port}` : hostPostfix;
    // Grab the target host from the connection configuration, and from a redirect message
    // otherwise, leave the message empty.
    const routingMessage = this.routingData ? ` (redirected from ${this.config.server}${hostPostfix})` : '';
    const message = `Failed to connect to ${server}${port}${routingMessage} in ${this.config.options.connectTimeout}ms`;
    this.debug.log(message);
    this.emit('connect', new _errors.ConnectionError(message, 'ETIMEOUT'));
    this.connectTimer = undefined;
    this.dispatchEvent('connectTimeout');
  }

  /**
   * @private
   */
  cancelTimeout() {
    const message = `Failed to cancel request in ${this.config.options.cancelTimeout}ms`;
    this.debug.log(message);
    this.dispatchEvent('socketError', new _errors.ConnectionError(message, 'ETIMEOUT'));
  }

  /**
   * @private
   */
  requestTimeout() {
    this.requestTimer = undefined;
    const request = this.request;
    request.cancel();
    const timeout = request.timeout !== undefined ? request.timeout : this.config.options.requestTimeout;
    const message = 'Timeout: Request failed to complete in ' + timeout + 'ms';
    request.error = new _errors.RequestError(message, 'ETIMEOUT');
  }

  /**
   * @private
   */
  retryTimeout() {
    this.retryTimer = undefined;
    this.emit('retry');
    this.transitionTo(this.STATE.CONNECTING);
  }

  /**
   * @private
   */
  clearConnectTimer() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = undefined;
    }
  }

  /**
   * @private
   */
  clearCancelTimer() {
    if (this.cancelTimer) {
      clearTimeout(this.cancelTimer);
      this.cancelTimer = undefined;
    }
  }

  /**
   * @private
   */
  clearRequestTimer() {
    if (this.requestTimer) {
      clearTimeout(this.requestTimer);
      this.requestTimer = undefined;
    }
  }

  /**
   * @private
   */
  clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  /**
   * @private
   */
  transitionTo(newState) {
    if (this.state === newState) {
      this.debug.log('State is already ' + newState.name);
      return;
    }
    if (this.state && this.state.exit) {
      this.state.exit.call(this, newState);
    }
    this.debug.log('State change: ' + (this.state ? this.state.name : 'undefined') + ' -> ' + newState.name);
    this.state = newState;
    if (this.state.enter) {
      this.state.enter.apply(this);
    }
  }

  /**
   * @private
   */
  getEventHandler(eventName) {
    const handler = this.state.events[eventName];
    if (!handler) {
      throw new Error(`No event '${eventName}' in state '${this.state.name}'`);
    }
    return handler;
  }

  /**
   * @private
   */
  dispatchEvent(eventName, ...args) {
    const handler = this.state.events[eventName];
    if (handler) {
      handler.apply(this, args);
    } else {
      this.emit('error', new Error(`No event '${eventName}' in state '${this.state.name}'`));
      this.close();
    }
  }

  /**
   * @private
   */
  socketError(error) {
    if (this.state === this.STATE.CONNECTING || this.state === this.STATE.SENT_TLSSSLNEGOTIATION) {
      const hostPostfix = this.config.options.port ? `:${this.config.options.port}` : `\\${this.config.options.instanceName}`;
      // If we have routing data stored, this connection has been redirected
      const server = this.routingData ? this.routingData.server : this.config.server;
      const port = this.routingData ? `:${this.routingData.port}` : hostPostfix;
      // Grab the target host from the connection configuration, and from a redirect message
      // otherwise, leave the message empty.
      const routingMessage = this.routingData ? ` (redirected from ${this.config.server}${hostPostfix})` : '';
      const message = `Failed to connect to ${server}${port}${routingMessage} - ${error.message}`;
      this.debug.log(message);
      this.emit('connect', new _errors.ConnectionError(message, 'ESOCKET', {
        cause: error
      }));
    } else {
      const message = `Connection lost - ${error.message}`;
      this.debug.log(message);
      this.emit('error', new _errors.ConnectionError(message, 'ESOCKET', {
        cause: error
      }));
    }
    this.dispatchEvent('socketError', error);
  }

  /**
   * @private
   */
  socketEnd() {
    this.debug.log('socket ended');
    if (this.state !== this.STATE.FINAL) {
      const error = new Error('socket hang up');
      error.code = 'ECONNRESET';
      this.socketError(error);
    }
  }

  /**
   * @private
   */
  socketClose() {
    this.debug.log('connection to ' + this.config.server + ':' + this.config.options.port + ' closed');
    if (this.state === this.STATE.REROUTING) {
      this.debug.log('Rerouting to ' + this.routingData.server + ':' + this.routingData.port);
      this.dispatchEvent('reconnect');
    } else if (this.state === this.STATE.TRANSIENT_FAILURE_RETRY) {
      const server = this.routingData ? this.routingData.server : this.config.server;
      const port = this.routingData ? this.routingData.port : this.config.options.port;
      this.debug.log('Retry after transient failure connecting to ' + server + ':' + port);
      this.dispatchEvent('retry');
    } else {
      this.transitionTo(this.STATE.FINAL);
    }
  }

  /**
   * @private
   */
  sendPreLogin() {
    const [, major, minor, build] = /^(\d+)\.(\d+)\.(\d+)/.exec(_package.version) ?? ['0.0.0', '0', '0', '0'];
    const payload = new _preloginPayload.default({
      // If encrypt setting is set to 'strict', then we should have already done the encryption before calling
      // this function. Therefore, the encrypt will be set to false here.
      // Otherwise, we will set encrypt here based on the encrypt Boolean value from the configuration.
      encrypt: typeof this.config.options.encrypt === 'boolean' && this.config.options.encrypt,
      version: {
        major: Number(major),
        minor: Number(minor),
        build: Number(build),
        subbuild: 0
      }
    });
    this.messageIo.sendMessage(_packet.TYPE.PRELOGIN, payload.data);
    this.debug.payload(function () {
      return payload.toString('  ');
    });
  }

  /**
   * @private
   */
  sendLogin7Packet() {
    const payload = new _login7Payload.default({
      tdsVersion: _tdsVersions.versions[this.config.options.tdsVersion],
      packetSize: this.config.options.packetSize,
      clientProgVer: 0,
      clientPid: process.pid,
      connectionId: 0,
      clientTimeZone: new Date().getTimezoneOffset(),
      clientLcid: 0x00000409
    });
    const {
      authentication
    } = this.config;
    switch (authentication.type) {
      case 'azure-active-directory-password':
        payload.fedAuth = {
          type: 'ADAL',
          echo: this.fedAuthRequired,
          workflow: 'default'
        };
        break;
      case 'azure-active-directory-access-token':
        payload.fedAuth = {
          type: 'SECURITYTOKEN',
          echo: this.fedAuthRequired,
          fedAuthToken: authentication.options.token
        };
        break;
      case 'token-credential':
      case 'azure-active-directory-msi-vm':
      case 'azure-active-directory-default':
      case 'azure-active-directory-msi-app-service':
      case 'azure-active-directory-service-principal-secret':
        payload.fedAuth = {
          type: 'ADAL',
          echo: this.fedAuthRequired,
          workflow: 'integrated'
        };
        break;
      case 'ntlm':
        payload.sspi = (0, _ntlm.createNTLMRequest)({
          domain: authentication.options.domain
        });
        break;
      default:
        payload.userName = authentication.options.userName;
        payload.password = authentication.options.password;
    }
    payload.hostname = this.config.options.workstationId || _os.default.hostname();
    payload.serverName = this.routingData ? this.routingData.server : this.config.server;
    payload.appName = this.config.options.appName || 'Tedious';
    payload.libraryName = _library.name;
    payload.language = this.config.options.language;
    payload.database = this.config.options.database;
    payload.clientId = Buffer.from([1, 2, 3, 4, 5, 6]);
    payload.readOnlyIntent = this.config.options.readOnlyIntent;
    payload.initDbFatal = !this.config.options.fallbackToDefaultDb;
    this.routingData = undefined;
    this.messageIo.sendMessage(_packet.TYPE.LOGIN7, payload.toBuffer());
    this.debug.payload(function () {
      return payload.toString('  ');
    });
  }

  /**
   * @private
   */
  sendFedAuthTokenMessage(token) {
    const accessTokenLen = Buffer.byteLength(token, 'ucs2');
    const data = Buffer.alloc(8 + accessTokenLen);
    let offset = 0;
    offset = data.writeUInt32LE(accessTokenLen + 4, offset);
    offset = data.writeUInt32LE(accessTokenLen, offset);
    data.write(token, offset, 'ucs2');
    this.messageIo.sendMessage(_packet.TYPE.FEDAUTH_TOKEN, data);
    // sent the fedAuth token message, the rest is similar to standard login 7
    this.transitionTo(this.STATE.SENT_LOGIN7_WITH_STANDARD_LOGIN);
  }

  /**
   * @private
   */
  sendInitialSql() {
    const payload = new _sqlbatchPayload.default(this.getInitialSql(), this.currentTransactionDescriptor(), this.config.options);
    const message = new _message.default({
      type: _packet.TYPE.SQL_BATCH
    });
    this.messageIo.outgoingMessageStream.write(message);
    _stream.Readable.from(payload).pipe(message);
  }

  /**
   * @private
   */
  getInitialSql() {
    const options = [];
    if (this.config.options.enableAnsiNull === true) {
      options.push('set ansi_nulls on');
    } else if (this.config.options.enableAnsiNull === false) {
      options.push('set ansi_nulls off');
    }
    if (this.config.options.enableAnsiNullDefault === true) {
      options.push('set ansi_null_dflt_on on');
    } else if (this.config.options.enableAnsiNullDefault === false) {
      options.push('set ansi_null_dflt_on off');
    }
    if (this.config.options.enableAnsiPadding === true) {
      options.push('set ansi_padding on');
    } else if (this.config.options.enableAnsiPadding === false) {
      options.push('set ansi_padding off');
    }
    if (this.config.options.enableAnsiWarnings === true) {
      options.push('set ansi_warnings on');
    } else if (this.config.options.enableAnsiWarnings === false) {
      options.push('set ansi_warnings off');
    }
    if (this.config.options.enableArithAbort === true) {
      options.push('set arithabort on');
    } else if (this.config.options.enableArithAbort === false) {
      options.push('set arithabort off');
    }
    if (this.config.options.enableConcatNullYieldsNull === true) {
      options.push('set concat_null_yields_null on');
    } else if (this.config.options.enableConcatNullYieldsNull === false) {
      options.push('set concat_null_yields_null off');
    }
    if (this.config.options.enableCursorCloseOnCommit === true) {
      options.push('set cursor_close_on_commit on');
    } else if (this.config.options.enableCursorCloseOnCommit === false) {
      options.push('set cursor_close_on_commit off');
    }
    if (this.config.options.datefirst !== null) {
      options.push(`set datefirst ${this.config.options.datefirst}`);
    }
    if (this.config.options.dateFormat !== null) {
      options.push(`set dateformat ${this.config.options.dateFormat}`);
    }
    if (this.config.options.enableImplicitTransactions === true) {
      options.push('set implicit_transactions on');
    } else if (this.config.options.enableImplicitTransactions === false) {
      options.push('set implicit_transactions off');
    }
    if (this.config.options.language !== null) {
      options.push(`set language ${this.config.options.language}`);
    }
    if (this.config.options.enableNumericRoundabort === true) {
      options.push('set numeric_roundabort on');
    } else if (this.config.options.enableNumericRoundabort === false) {
      options.push('set numeric_roundabort off');
    }
    if (this.config.options.enableQuotedIdentifier === true) {
      options.push('set quoted_identifier on');
    } else if (this.config.options.enableQuotedIdentifier === false) {
      options.push('set quoted_identifier off');
    }
    if (this.config.options.textsize !== null) {
      options.push(`set textsize ${this.config.options.textsize}`);
    }
    if (this.config.options.connectionIsolationLevel !== null) {
      options.push(`set transaction isolation level ${this.getIsolationLevelText(this.config.options.connectionIsolationLevel)}`);
    }
    if (this.config.options.abortTransactionOnError === true) {
      options.push('set xact_abort on');
    } else if (this.config.options.abortTransactionOnError === false) {
      options.push('set xact_abort off');
    }
    return options.join('\n');
  }

  /**
   * @private
   */
  processedInitialSql() {
    this.clearConnectTimer();
    this.emit('connect');
  }

  /**
   * Execute the SQL batch represented by [[Request]].
   * There is no param support, and unlike [[Request.execSql]],
   * it is not likely that SQL Server will reuse the execution plan it generates for the SQL.
   *
   * In almost all cases, [[Request.execSql]] will be a better choice.
   *
   * @param request A [[Request]] object representing the request.
   */
  execSqlBatch(request) {
    this.makeRequest(request, _packet.TYPE.SQL_BATCH, new _sqlbatchPayload.default(request.sqlTextOrProcedure, this.currentTransactionDescriptor(), this.config.options));
  }

  /**
   *  Execute the SQL represented by [[Request]].
   *
   * As `sp_executesql` is used to execute the SQL, if the same SQL is executed multiples times
   * using this function, the SQL Server query optimizer is likely to reuse the execution plan it generates
   * for the first execution. This may also result in SQL server treating the request like a stored procedure
   * which can result in the [[Event_doneInProc]] or [[Event_doneProc]] events being emitted instead of the
   * [[Event_done]] event you might expect. Using [[execSqlBatch]] will prevent this from occurring but may have a negative performance impact.
   *
   * Beware of the way that scoping rules apply, and how they may [affect local temp tables](http://weblogs.sqlteam.com/mladenp/archive/2006/11/03/17197.aspx)
   * If you're running in to scoping issues, then [[execSqlBatch]] may be a better choice.
   * See also [issue #24](https://github.com/pekim/tedious/issues/24)
   *
   * @param request A [[Request]] object representing the request.
   */
  execSql(request) {
    try {
      request.validateParameters(this.databaseCollation);
    } catch (error) {
      request.error = error;
      process.nextTick(() => {
        this.debug.log(error.message);
        request.callback(error);
      });
      return;
    }
    const parameters = [];
    parameters.push({
      type: _dataType.TYPES.NVarChar,
      name: 'statement',
      value: request.sqlTextOrProcedure,
      output: false,
      length: undefined,
      precision: undefined,
      scale: undefined
    });
    if (request.parameters.length) {
      parameters.push({
        type: _dataType.TYPES.NVarChar,
        name: 'params',
        value: request.makeParamsParameter(request.parameters),
        output: false,
        length: undefined,
        precision: undefined,
        scale: undefined
      });
      parameters.push(...request.parameters);
    }
    this.makeRequest(request, _packet.TYPE.RPC_REQUEST, new _rpcrequestPayload.default(_specialStoredProcedure.default.Sp_ExecuteSql, parameters, this.currentTransactionDescriptor(), this.config.options, this.databaseCollation));
  }

  /**
   * Creates a new BulkLoad instance.
   *
   * @param table The name of the table to bulk-insert into.
   * @param options A set of bulk load options.
   */

  newBulkLoad(table, callbackOrOptions, callback) {
    let options;
    if (callback === undefined) {
      callback = callbackOrOptions;
      options = {};
    } else {
      options = callbackOrOptions;
    }
    if (typeof options !== 'object') {
      throw new TypeError('"options" argument must be an object');
    }
    return new _bulkLoad.default(table, this.databaseCollation, this.config.options, options, callback);
  }

  /**
   * Execute a [[BulkLoad]].
   *
   * ```js
   * // We want to perform a bulk load into a table with the following format:
   * // CREATE TABLE employees (first_name nvarchar(255), last_name nvarchar(255), day_of_birth date);
   *
   * const bulkLoad = connection.newBulkLoad('employees', (err, rowCount) => {
   *   // ...
   * });
   *
   * // First, we need to specify the columns that we want to write to,
   * // and their definitions. These definitions must match the actual table,
   * // otherwise the bulk load will fail.
   * bulkLoad.addColumn('first_name', TYPES.NVarchar, { nullable: false });
   * bulkLoad.addColumn('last_name', TYPES.NVarchar, { nullable: false });
   * bulkLoad.addColumn('date_of_birth', TYPES.Date, { nullable: false });
   *
   * // Execute a bulk load with a predefined list of rows.
   * //
   * // Note that these rows are held in memory until the
   * // bulk load was performed, so if you need to write a large
   * // number of rows (e.g. by reading from a CSV file),
   * // passing an `AsyncIterable` is advisable to keep memory usage low.
   * connection.execBulkLoad(bulkLoad, [
   *   { 'first_name': 'Steve', 'last_name': 'Jobs', 'day_of_birth': new Date('02-24-1955') },
   *   { 'first_name': 'Bill', 'last_name': 'Gates', 'day_of_birth': new Date('10-28-1955') }
   * ]);
   * ```
   *
   * @param bulkLoad A previously created [[BulkLoad]].
   * @param rows A [[Iterable]] or [[AsyncIterable]] that contains the rows that should be bulk loaded.
   */

  execBulkLoad(bulkLoad, rows) {
    bulkLoad.executionStarted = true;
    if (rows) {
      if (bulkLoad.streamingMode) {
        throw new Error("Connection.execBulkLoad can't be called with a BulkLoad that was put in streaming mode.");
      }
      if (bulkLoad.firstRowWritten) {
        throw new Error("Connection.execBulkLoad can't be called with a BulkLoad that already has rows written to it.");
      }
      const rowStream = _stream.Readable.from(rows);

      // Destroy the packet transform if an error happens in the row stream,
      // e.g. if an error is thrown from within a generator or stream.
      rowStream.on('error', err => {
        bulkLoad.rowToPacketTransform.destroy(err);
      });

      // Destroy the row stream if an error happens in the packet transform,
      // e.g. if the bulk load is cancelled.
      bulkLoad.rowToPacketTransform.on('error', err => {
        rowStream.destroy(err);
      });
      rowStream.pipe(bulkLoad.rowToPacketTransform);
    } else if (!bulkLoad.streamingMode) {
      // If the bulkload was not put into streaming mode by the user,
      // we end the rowToPacketTransform here for them.
      //
      // If it was put into streaming mode, it's the user's responsibility
      // to end the stream.
      bulkLoad.rowToPacketTransform.end();
    }
    const onCancel = () => {
      request.cancel();
    };
    const payload = new _bulkLoadPayload.BulkLoadPayload(bulkLoad);
    const request = new _request.default(bulkLoad.getBulkInsertSql(), error => {
      bulkLoad.removeListener('cancel', onCancel);
      if (error) {
        if (error.code === 'UNKNOWN') {
          error.message += ' This is likely because the schema of the BulkLoad does not match the schema of the table you are attempting to insert into.';
        }
        bulkLoad.error = error;
        bulkLoad.callback(error);
        return;
      }
      this.makeRequest(bulkLoad, _packet.TYPE.BULK_LOAD, payload);
    });
    bulkLoad.once('cancel', onCancel);
    this.execSqlBatch(request);
  }

  /**
   * Prepare the SQL represented by the request.
   *
   * The request can then be used in subsequent calls to
   * [[execute]] and [[unprepare]]
   *
   * @param request A [[Request]] object representing the request.
   *   Parameters only require a name and type. Parameter values are ignored.
   */
  prepare(request) {
    const parameters = [];
    parameters.push({
      type: _dataType.TYPES.Int,
      name: 'handle',
      value: undefined,
      output: true,
      length: undefined,
      precision: undefined,
      scale: undefined
    });
    parameters.push({
      type: _dataType.TYPES.NVarChar,
      name: 'params',
      value: request.parameters.length ? request.makeParamsParameter(request.parameters) : null,
      output: false,
      length: undefined,
      precision: undefined,
      scale: undefined
    });
    parameters.push({
      type: _dataType.TYPES.NVarChar,
      name: 'stmt',
      value: request.sqlTextOrProcedure,
      output: false,
      length: undefined,
      precision: undefined,
      scale: undefined
    });
    request.preparing = true;

    // TODO: We need to clean up this event handler, otherwise this leaks memory
    request.on('returnValue', (name, value) => {
      if (name === 'handle') {
        request.handle = value;
      } else {
        request.error = new _errors.RequestError(`Tedious > Unexpected output parameter ${name} from sp_prepare`);
      }
    });
    this.makeRequest(request, _packet.TYPE.RPC_REQUEST, new _rpcrequestPayload.default(_specialStoredProcedure.default.Sp_Prepare, parameters, this.currentTransactionDescriptor(), this.config.options, this.databaseCollation));
  }

  /**
   * Release the SQL Server resources associated with a previously prepared request.
   *
   * @param request A [[Request]] object representing the request.
   *   Parameters only require a name and type.
   *   Parameter values are ignored.
   */
  unprepare(request) {
    const parameters = [];
    parameters.push({
      type: _dataType.TYPES.Int,
      name: 'handle',
      // TODO: Abort if `request.handle` is not set
      value: request.handle,
      output: false,
      length: undefined,
      precision: undefined,
      scale: undefined
    });
    this.makeRequest(request, _packet.TYPE.RPC_REQUEST, new _rpcrequestPayload.default(_specialStoredProcedure.default.Sp_Unprepare, parameters, this.currentTransactionDescriptor(), this.config.options, this.databaseCollation));
  }

  /**
   * Execute previously prepared SQL, using the supplied parameters.
   *
   * @param request A previously prepared [[Request]].
   * @param parameters  An object whose names correspond to the names of
   *   parameters that were added to the [[Request]] before it was prepared.
   *   The object's values are passed as the parameters' values when the
   *   request is executed.
   */
  execute(request, parameters) {
    const executeParameters = [];
    executeParameters.push({
      type: _dataType.TYPES.Int,
      name: '',
      // TODO: Abort if `request.handle` is not set
      value: request.handle,
      output: false,
      length: undefined,
      precision: undefined,
      scale: undefined
    });
    try {
      for (let i = 0, len = request.parameters.length; i < len; i++) {
        const parameter = request.parameters[i];
        executeParameters.push({
          ...parameter,
          value: parameter.type.validate(parameters ? parameters[parameter.name] : null, this.databaseCollation)
        });
      }
    } catch (error) {
      request.error = error;
      process.nextTick(() => {
        this.debug.log(error.message);
        request.callback(error);
      });
      return;
    }
    this.makeRequest(request, _packet.TYPE.RPC_REQUEST, new _rpcrequestPayload.default(_specialStoredProcedure.default.Sp_Execute, executeParameters, this.currentTransactionDescriptor(), this.config.options, this.databaseCollation));
  }

  /**
   * Call a stored procedure represented by [[Request]].
   *
   * @param request A [[Request]] object representing the request.
   */
  callProcedure(request) {
    try {
      request.validateParameters(this.databaseCollation);
    } catch (error) {
      request.error = error;
      process.nextTick(() => {
        this.debug.log(error.message);
        request.callback(error);
      });
      return;
    }
    this.makeRequest(request, _packet.TYPE.RPC_REQUEST, new _rpcrequestPayload.default(request.sqlTextOrProcedure, request.parameters, this.currentTransactionDescriptor(), this.config.options, this.databaseCollation));
  }

  /**
   * Start a transaction.
   *
   * @param callback
   * @param name A string representing a name to associate with the transaction.
   *   Optional, and defaults to an empty string. Required when `isolationLevel`
   *   is present.
   * @param isolationLevel The isolation level that the transaction is to be run with.
   *
   *   The isolation levels are available from `require('tedious').ISOLATION_LEVEL`.
   *   * `READ_UNCOMMITTED`
   *   * `READ_COMMITTED`
   *   * `REPEATABLE_READ`
   *   * `SERIALIZABLE`
   *   * `SNAPSHOT`
   *
   *   Optional, and defaults to the Connection's isolation level.
   */
  beginTransaction(callback, name = '', isolationLevel = this.config.options.isolationLevel) {
    (0, _transaction.assertValidIsolationLevel)(isolationLevel, 'isolationLevel');
    const transaction = new _transaction.Transaction(name, isolationLevel);
    if (this.config.options.tdsVersion < '7_2') {
      return this.execSqlBatch(new _request.default('SET TRANSACTION ISOLATION LEVEL ' + transaction.isolationLevelToTSQL() + ';BEGIN TRAN ' + transaction.name, err => {
        this.transactionDepth++;
        if (this.transactionDepth === 1) {
          this.inTransaction = true;
        }
        callback(err);
      }));
    }
    const request = new _request.default(undefined, err => {
      return callback(err, this.currentTransactionDescriptor());
    });
    return this.makeRequest(request, _packet.TYPE.TRANSACTION_MANAGER, transaction.beginPayload(this.currentTransactionDescriptor()));
  }

  /**
   * Commit a transaction.
   *
   * There should be an active transaction - that is, [[beginTransaction]]
   * should have been previously called.
   *
   * @param callback
   * @param name A string representing a name to associate with the transaction.
   *   Optional, and defaults to an empty string. Required when `isolationLevel`is present.
   */
  commitTransaction(callback, name = '') {
    const transaction = new _transaction.Transaction(name);
    if (this.config.options.tdsVersion < '7_2') {
      return this.execSqlBatch(new _request.default('COMMIT TRAN ' + transaction.name, err => {
        this.transactionDepth--;
        if (this.transactionDepth === 0) {
          this.inTransaction = false;
        }
        callback(err);
      }));
    }
    const request = new _request.default(undefined, callback);
    return this.makeRequest(request, _packet.TYPE.TRANSACTION_MANAGER, transaction.commitPayload(this.currentTransactionDescriptor()));
  }

  /**
   * Rollback a transaction.
   *
   * There should be an active transaction - that is, [[beginTransaction]]
   * should have been previously called.
   *
   * @param callback
   * @param name A string representing a name to associate with the transaction.
   *   Optional, and defaults to an empty string.
   *   Required when `isolationLevel` is present.
   */
  rollbackTransaction(callback, name = '') {
    const transaction = new _transaction.Transaction(name);
    if (this.config.options.tdsVersion < '7_2') {
      return this.execSqlBatch(new _request.default('ROLLBACK TRAN ' + transaction.name, err => {
        this.transactionDepth--;
        if (this.transactionDepth === 0) {
          this.inTransaction = false;
        }
        callback(err);
      }));
    }
    const request = new _request.default(undefined, callback);
    return this.makeRequest(request, _packet.TYPE.TRANSACTION_MANAGER, transaction.rollbackPayload(this.currentTransactionDescriptor()));
  }

  /**
   * Set a savepoint within a transaction.
   *
   * There should be an active transaction - that is, [[beginTransaction]]
   * should have been previously called.
   *
   * @param callback
   * @param name A string representing a name to associate with the transaction.\
   *   Optional, and defaults to an empty string.
   *   Required when `isolationLevel` is present.
   */
  saveTransaction(callback, name) {
    const transaction = new _transaction.Transaction(name);
    if (this.config.options.tdsVersion < '7_2') {
      return this.execSqlBatch(new _request.default('SAVE TRAN ' + transaction.name, err => {
        this.transactionDepth++;
        callback(err);
      }));
    }
    const request = new _request.default(undefined, callback);
    return this.makeRequest(request, _packet.TYPE.TRANSACTION_MANAGER, transaction.savePayload(this.currentTransactionDescriptor()));
  }

  /**
   * Run the given callback after starting a transaction, and commit or
   * rollback the transaction afterwards.
   *
   * This is a helper that employs [[beginTransaction]], [[commitTransaction]],
   * [[rollbackTransaction]], and [[saveTransaction]] to greatly simplify the
   * use of database transactions and automatically handle transaction nesting.
   *
   * @param cb
   * @param isolationLevel
   *   The isolation level that the transaction is to be run with.
   *
   *   The isolation levels are available from `require('tedious').ISOLATION_LEVEL`.
   *   * `READ_UNCOMMITTED`
   *   * `READ_COMMITTED`
   *   * `REPEATABLE_READ`
   *   * `SERIALIZABLE`
   *   * `SNAPSHOT`
   *
   *   Optional, and defaults to the Connection's isolation level.
   */
  transaction(cb, isolationLevel) {
    if (typeof cb !== 'function') {
      throw new TypeError('`cb` must be a function');
    }
    const useSavepoint = this.inTransaction;
    const name = '_tedious_' + _crypto.default.randomBytes(10).toString('hex');
    const txDone = (err, done, ...args) => {
      if (err) {
        if (this.inTransaction && this.state === this.STATE.LOGGED_IN) {
          this.rollbackTransaction(txErr => {
            done(txErr || err, ...args);
          }, name);
        } else {
          done(err, ...args);
        }
      } else if (useSavepoint) {
        if (this.config.options.tdsVersion < '7_2') {
          this.transactionDepth--;
        }
        done(null, ...args);
      } else {
        this.commitTransaction(txErr => {
          done(txErr, ...args);
        }, name);
      }
    };
    if (useSavepoint) {
      return this.saveTransaction(err => {
        if (err) {
          return cb(err);
        }
        if (isolationLevel) {
          return this.execSqlBatch(new _request.default('SET transaction isolation level ' + this.getIsolationLevelText(isolationLevel), err => {
            return cb(err, txDone);
          }));
        } else {
          return cb(null, txDone);
        }
      }, name);
    } else {
      return this.beginTransaction(err => {
        if (err) {
          return cb(err);
        }
        return cb(null, txDone);
      }, name, isolationLevel);
    }
  }

  /**
   * @private
   */
  makeRequest(request, packetType, payload) {
    if (this.state !== this.STATE.LOGGED_IN) {
      const message = 'Requests can only be made in the ' + this.STATE.LOGGED_IN.name + ' state, not the ' + this.state.name + ' state';
      this.debug.log(message);
      request.callback(new _errors.RequestError(message, 'EINVALIDSTATE'));
    } else if (request.canceled) {
      process.nextTick(() => {
        request.callback(new _errors.RequestError('Canceled.', 'ECANCEL'));
      });
    } else {
      if (packetType === _packet.TYPE.SQL_BATCH) {
        this.isSqlBatch = true;
      } else {
        this.isSqlBatch = false;
      }
      this.request = request;
      request.connection = this;
      request.rowCount = 0;
      request.rows = [];
      request.rst = [];
      const onCancel = () => {
        payloadStream.unpipe(message);
        payloadStream.destroy(new _errors.RequestError('Canceled.', 'ECANCEL'));

        // set the ignore bit and end the message.
        message.ignore = true;
        message.end();
        if (request instanceof _request.default && request.paused) {
          // resume the request if it was paused so we can read the remaining tokens
          request.resume();
        }
      };
      request.once('cancel', onCancel);
      this.createRequestTimer();
      const message = new _message.default({
        type: packetType,
        resetConnection: this.resetConnectionOnNextRequest
      });
      this.messageIo.outgoingMessageStream.write(message);
      this.transitionTo(this.STATE.SENT_CLIENT_REQUEST);
      message.once('finish', () => {
        request.removeListener('cancel', onCancel);
        request.once('cancel', this._cancelAfterRequestSent);
        this.resetConnectionOnNextRequest = false;
        this.debug.payload(function () {
          return payload.toString('  ');
        });
      });
      const payloadStream = _stream.Readable.from(payload);
      payloadStream.once('error', error => {
        payloadStream.unpipe(message);

        // Only set a request error if no error was set yet.
        request.error ??= error;
        message.ignore = true;
        message.end();
      });
      payloadStream.pipe(message);
    }
  }

  /**
   * Cancel currently executed request.
   */
  cancel() {
    if (!this.request) {
      return false;
    }
    if (this.request.canceled) {
      return false;
    }
    this.request.cancel();
    return true;
  }

  /**
   * Reset the connection to its initial state.
   * Can be useful for connection pool implementations.
   *
   * @param callback
   */
  reset(callback) {
    const request = new _request.default(this.getInitialSql(), err => {
      if (this.config.options.tdsVersion < '7_2') {
        this.inTransaction = false;
      }
      callback(err);
    });
    this.resetConnectionOnNextRequest = true;
    this.execSqlBatch(request);
  }

  /**
   * @private
   */
  currentTransactionDescriptor() {
    return this.transactionDescriptors[this.transactionDescriptors.length - 1];
  }

  /**
   * @private
   */
  getIsolationLevelText(isolationLevel) {
    switch (isolationLevel) {
      case _transaction.ISOLATION_LEVEL.READ_UNCOMMITTED:
        return 'read uncommitted';
      case _transaction.ISOLATION_LEVEL.REPEATABLE_READ:
        return 'repeatable read';
      case _transaction.ISOLATION_LEVEL.SERIALIZABLE:
        return 'serializable';
      case _transaction.ISOLATION_LEVEL.SNAPSHOT:
        return 'snapshot';
      default:
        return 'read committed';
    }
  }
}
function isTransientError(error) {
  if (error instanceof AggregateError) {
    error = error.errors[0];
  }
  return error instanceof _errors.ConnectionError && !!error.isTransient;
}
var _default = exports.default = Connection;
module.exports = Connection;
Connection.prototype.STATE = {
  INITIALIZED: {
    name: 'Initialized',
    events: {}
  },
  CONNECTING: {
    name: 'Connecting',
    enter: function () {
      this.initialiseConnection();
    },
    events: {
      socketError: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function () {
        this.transitionTo(this.STATE.FINAL);
      }
    }
  },
  SENT_PRELOGIN: {
    name: 'SentPrelogin',
    enter: function () {
      (async () => {
        let messageBuffer = Buffer.alloc(0);
        let message;
        try {
          message = await this.messageIo.readMessage();
        } catch (err) {
          return this.socketError(err);
        }
        for await (const data of message) {
          messageBuffer = Buffer.concat([messageBuffer, data]);
        }
        const preloginPayload = new _preloginPayload.default(messageBuffer);
        this.debug.payload(function () {
          return preloginPayload.toString('  ');
        });
        if (preloginPayload.fedAuthRequired === 1) {
          this.fedAuthRequired = true;
        }
        if ('strict' !== this.config.options.encrypt && (preloginPayload.encryptionString === 'ON' || preloginPayload.encryptionString === 'REQ')) {
          if (!this.config.options.encrypt) {
            this.emit('connect', new _errors.ConnectionError("Server requires encryption, set 'encrypt' config option to true.", 'EENCRYPT'));
            return this.close();
          }
          try {
            this.transitionTo(this.STATE.SENT_TLSSSLNEGOTIATION);
            await this.messageIo.startTls(this.secureContextOptions, this.config.options.serverName ? this.config.options.serverName : this.routingData?.server ?? this.config.server, this.config.options.trustServerCertificate);
          } catch (err) {
            return this.socketError(err);
          }
        }
        this.sendLogin7Packet();
        const {
          authentication
        } = this.config;
        switch (authentication.type) {
          case 'token-credential':
          case 'azure-active-directory-password':
          case 'azure-active-directory-msi-vm':
          case 'azure-active-directory-msi-app-service':
          case 'azure-active-directory-service-principal-secret':
          case 'azure-active-directory-default':
            this.transitionTo(this.STATE.SENT_LOGIN7_WITH_FEDAUTH);
            break;
          case 'ntlm':
            this.transitionTo(this.STATE.SENT_LOGIN7_WITH_NTLM);
            break;
          default:
            this.transitionTo(this.STATE.SENT_LOGIN7_WITH_STANDARD_LOGIN);
            break;
        }
      })().catch(err => {
        process.nextTick(() => {
          throw err;
        });
      });
    },
    events: {
      socketError: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function () {
        this.transitionTo(this.STATE.FINAL);
      }
    }
  },
  REROUTING: {
    name: 'ReRouting',
    enter: function () {
      this.cleanupConnection(CLEANUP_TYPE.REDIRECT);
    },
    events: {
      message: function () {},
      socketError: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      reconnect: function () {
        this.transitionTo(this.STATE.CONNECTING);
      }
    }
  },
  TRANSIENT_FAILURE_RETRY: {
    name: 'TRANSIENT_FAILURE_RETRY',
    enter: function () {
      this.curTransientRetryCount++;
      this.cleanupConnection(CLEANUP_TYPE.RETRY);
    },
    events: {
      message: function () {},
      socketError: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      retry: function () {
        this.createRetryTimer();
      }
    }
  },
  SENT_TLSSSLNEGOTIATION: {
    name: 'SentTLSSSLNegotiation',
    events: {
      socketError: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function () {
        this.transitionTo(this.STATE.FINAL);
      }
    }
  },
  SENT_LOGIN7_WITH_STANDARD_LOGIN: {
    name: 'SentLogin7WithStandardLogin',
    enter: function () {
      (async () => {
        let message;
        try {
          message = await this.messageIo.readMessage();
        } catch (err) {
          return this.socketError(err);
        }
        const handler = new _handler.Login7TokenHandler(this);
        const tokenStreamParser = this.createTokenStreamParser(message, handler);
        await (0, _events.once)(tokenStreamParser, 'end');
        if (handler.loginAckReceived) {
          if (handler.routingData) {
            this.routingData = handler.routingData;
            this.transitionTo(this.STATE.REROUTING);
          } else {
            this.transitionTo(this.STATE.LOGGED_IN_SENDING_INITIAL_SQL);
          }
        } else if (this.loginError) {
          if (isTransientError(this.loginError)) {
            this.debug.log('Initiating retry on transient error');
            this.transitionTo(this.STATE.TRANSIENT_FAILURE_RETRY);
          } else {
            this.emit('connect', this.loginError);
            this.transitionTo(this.STATE.FINAL);
          }
        } else {
          this.emit('connect', new _errors.ConnectionError('Login failed.', 'ELOGIN'));
          this.transitionTo(this.STATE.FINAL);
        }
      })().catch(err => {
        process.nextTick(() => {
          throw err;
        });
      });
    },
    events: {
      socketError: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function () {
        this.transitionTo(this.STATE.FINAL);
      }
    }
  },
  SENT_LOGIN7_WITH_NTLM: {
    name: 'SentLogin7WithNTLMLogin',
    enter: function () {
      (async () => {
        while (true) {
          let message;
          try {
            message = await this.messageIo.readMessage();
          } catch (err) {
            return this.socketError(err);
          }
          const handler = new _handler.Login7TokenHandler(this);
          const tokenStreamParser = this.createTokenStreamParser(message, handler);
          await (0, _events.once)(tokenStreamParser, 'end');
          if (handler.loginAckReceived) {
            if (handler.routingData) {
              this.routingData = handler.routingData;
              return this.transitionTo(this.STATE.REROUTING);
            } else {
              return this.transitionTo(this.STATE.LOGGED_IN_SENDING_INITIAL_SQL);
            }
          } else if (this.ntlmpacket) {
            const authentication = this.config.authentication;
            const payload = new _ntlmPayload.default({
              domain: authentication.options.domain,
              userName: authentication.options.userName,
              password: authentication.options.password,
              ntlmpacket: this.ntlmpacket
            });
            this.messageIo.sendMessage(_packet.TYPE.NTLMAUTH_PKT, payload.data);
            this.debug.payload(function () {
              return payload.toString('  ');
            });
            this.ntlmpacket = undefined;
          } else if (this.loginError) {
            if (isTransientError(this.loginError)) {
              this.debug.log('Initiating retry on transient error');
              return this.transitionTo(this.STATE.TRANSIENT_FAILURE_RETRY);
            } else {
              this.emit('connect', this.loginError);
              return this.transitionTo(this.STATE.FINAL);
            }
          } else {
            this.emit('connect', new _errors.ConnectionError('Login failed.', 'ELOGIN'));
            return this.transitionTo(this.STATE.FINAL);
          }
        }
      })().catch(err => {
        process.nextTick(() => {
          throw err;
        });
      });
    },
    events: {
      socketError: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function () {
        this.transitionTo(this.STATE.FINAL);
      }
    }
  },
  SENT_LOGIN7_WITH_FEDAUTH: {
    name: 'SentLogin7Withfedauth',
    enter: function () {
      (async () => {
        let message;
        try {
          message = await this.messageIo.readMessage();
        } catch (err) {
          return this.socketError(err);
        }
        const handler = new _handler.Login7TokenHandler(this);
        const tokenStreamParser = this.createTokenStreamParser(message, handler);
        await (0, _events.once)(tokenStreamParser, 'end');
        if (handler.loginAckReceived) {
          if (handler.routingData) {
            this.routingData = handler.routingData;
            this.transitionTo(this.STATE.REROUTING);
          } else {
            this.transitionTo(this.STATE.LOGGED_IN_SENDING_INITIAL_SQL);
          }
          return;
        }
        const fedAuthInfoToken = handler.fedAuthInfoToken;
        if (fedAuthInfoToken && fedAuthInfoToken.stsurl && fedAuthInfoToken.spn) {
          /** Federated authentication configation. */
          const authentication = this.config.authentication;
          /** Permission scope to pass to Entra ID when requesting an authentication token. */
          const tokenScope = new _url.URL('/.default', fedAuthInfoToken.spn).toString();

          /** Instance of the token credential to use to authenticate to the resource. */
          let credentials;
          switch (authentication.type) {
            case 'token-credential':
              credentials = authentication.options.credential;
              break;
            case 'azure-active-directory-password':
              credentials = new _identity.UsernamePasswordCredential(authentication.options.tenantId ?? 'common', authentication.options.clientId, authentication.options.userName, authentication.options.password);
              break;
            case 'azure-active-directory-msi-vm':
            case 'azure-active-directory-msi-app-service':
              const msiArgs = authentication.options.clientId ? [authentication.options.clientId, {}] : [{}];
              credentials = new _identity.ManagedIdentityCredential(...msiArgs);
              break;
            case 'azure-active-directory-default':
              const args = authentication.options.clientId ? {
                managedIdentityClientId: authentication.options.clientId
              } : {};
              credentials = new _identity.DefaultAzureCredential(args);
              break;
            case 'azure-active-directory-service-principal-secret':
              credentials = new _identity.ClientSecretCredential(authentication.options.tenantId, authentication.options.clientId, authentication.options.clientSecret);
              break;
          }

          /** Access token retrieved from Entra ID for the configured permission scope(s). */
          let tokenResponse;
          try {
            tokenResponse = await credentials.getToken(tokenScope);
          } catch (err) {
            this.loginError = new AggregateError([new _errors.ConnectionError('Security token could not be authenticated or authorized.', 'EFEDAUTH'), err]);
            this.emit('connect', this.loginError);
            this.transitionTo(this.STATE.FINAL);
            return;
          }

          // Type guard the token value so that it is never null.
          if (tokenResponse === null) {
            this.loginError = new AggregateError([new _errors.ConnectionError('Security token could not be authenticated or authorized.', 'EFEDAUTH')]);
            this.emit('connect', this.loginError);
            this.transitionTo(this.STATE.FINAL);
            return;
          }
          this.sendFedAuthTokenMessage(tokenResponse.token);
        } else if (this.loginError) {
          if (isTransientError(this.loginError)) {
            this.debug.log('Initiating retry on transient error');
            this.transitionTo(this.STATE.TRANSIENT_FAILURE_RETRY);
          } else {
            this.emit('connect', this.loginError);
            this.transitionTo(this.STATE.FINAL);
          }
        } else {
          this.emit('connect', new _errors.ConnectionError('Login failed.', 'ELOGIN'));
          this.transitionTo(this.STATE.FINAL);
        }
      })().catch(err => {
        process.nextTick(() => {
          throw err;
        });
      });
    },
    events: {
      socketError: function () {
        this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function () {
        this.transitionTo(this.STATE.FINAL);
      }
    }
  },
  LOGGED_IN_SENDING_INITIAL_SQL: {
    name: 'LoggedInSendingInitialSql',
    enter: function () {
      (async () => {
        this.sendInitialSql();
        let message;
        try {
          message = await this.messageIo.readMessage();
        } catch (err) {
          return this.socketError(err);
        }
        const tokenStreamParser = this.createTokenStreamParser(message, new _handler.InitialSqlTokenHandler(this));
        await (0, _events.once)(tokenStreamParser, 'end');
        this.transitionTo(this.STATE.LOGGED_IN);
        this.processedInitialSql();
      })().catch(err => {
        process.nextTick(() => {
          throw err;
        });
      });
    },
    events: {
      socketError: function socketError() {
        this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function () {
        this.transitionTo(this.STATE.FINAL);
      }
    }
  },
  LOGGED_IN: {
    name: 'LoggedIn',
    events: {
      socketError: function () {
        this.transitionTo(this.STATE.FINAL);
      }
    }
  },
  SENT_CLIENT_REQUEST: {
    name: 'SentClientRequest',
    enter: function () {
      (async () => {
        let message;
        try {
          message = await this.messageIo.readMessage();
        } catch (err) {
          return this.socketError(err);
        }
        // request timer is stopped on first data package
        this.clearRequestTimer();
        const tokenStreamParser = this.createTokenStreamParser(message, new _handler.RequestTokenHandler(this, this.request));

        // If the request was canceled and we have a `cancelTimer`
        // defined, we send a attention message after the
        // request message was fully sent off.
        //
        // We already started consuming the current message
        // (but all the token handlers should be no-ops), and
        // need to ensure the next message is handled by the
        // `SENT_ATTENTION` state.
        if (this.request?.canceled && this.cancelTimer) {
          return this.transitionTo(this.STATE.SENT_ATTENTION);
        }
        const onResume = () => {
          tokenStreamParser.resume();
        };
        const onPause = () => {
          tokenStreamParser.pause();
          this.request?.once('resume', onResume);
        };
        this.request?.on('pause', onPause);
        if (this.request instanceof _request.default && this.request.paused) {
          onPause();
        }
        const onCancel = () => {
          tokenStreamParser.removeListener('end', onEndOfMessage);
          if (this.request instanceof _request.default && this.request.paused) {
            // resume the request if it was paused so we can read the remaining tokens
            this.request.resume();
          }
          this.request?.removeListener('pause', onPause);
          this.request?.removeListener('resume', onResume);

          // The `_cancelAfterRequestSent` callback will have sent a
          // attention message, so now we need to also switch to
          // the `SENT_ATTENTION` state to make sure the attention ack
          // message is processed correctly.
          this.transitionTo(this.STATE.SENT_ATTENTION);
        };
        const onEndOfMessage = () => {
          this.request?.removeListener('cancel', this._cancelAfterRequestSent);
          this.request?.removeListener('cancel', onCancel);
          this.request?.removeListener('pause', onPause);
          this.request?.removeListener('resume', onResume);
          this.transitionTo(this.STATE.LOGGED_IN);
          const sqlRequest = this.request;
          this.request = undefined;
          if (this.config.options.tdsVersion < '7_2' && sqlRequest.error && this.isSqlBatch) {
            this.inTransaction = false;
          }
          sqlRequest.callback(sqlRequest.error, sqlRequest.rowCount, sqlRequest.rows);
        };
        tokenStreamParser.once('end', onEndOfMessage);
        this.request?.once('cancel', onCancel);
      })();
    },
    exit: function (nextState) {
      this.clearRequestTimer();
    },
    events: {
      socketError: function (err) {
        const sqlRequest = this.request;
        this.request = undefined;
        this.transitionTo(this.STATE.FINAL);
        sqlRequest.callback(err);
      }
    }
  },
  SENT_ATTENTION: {
    name: 'SentAttention',
    enter: function () {
      (async () => {
        let message;
        try {
          message = await this.messageIo.readMessage();
        } catch (err) {
          return this.socketError(err);
        }
        const handler = new _handler.AttentionTokenHandler(this, this.request);
        const tokenStreamParser = this.createTokenStreamParser(message, handler);
        await (0, _events.once)(tokenStreamParser, 'end');
        // 3.2.5.7 Sent Attention State
        // Discard any data contained in the response, until we receive the attention response
        if (handler.attentionReceived) {
          this.clearCancelTimer();
          const sqlRequest = this.request;
          this.request = undefined;
          this.transitionTo(this.STATE.LOGGED_IN);
          if (sqlRequest.error && sqlRequest.error instanceof _errors.RequestError && sqlRequest.error.code === 'ETIMEOUT') {
            sqlRequest.callback(sqlRequest.error);
          } else {
            sqlRequest.callback(new _errors.RequestError('Canceled.', 'ECANCEL'));
          }
        }
      })().catch(err => {
        process.nextTick(() => {
          throw err;
        });
      });
    },
    events: {
      socketError: function (err) {
        const sqlRequest = this.request;
        this.request = undefined;
        this.transitionTo(this.STATE.FINAL);
        sqlRequest.callback(err);
      }
    }
  },
  FINAL: {
    name: 'Final',
    enter: function () {
      this.cleanupConnection(CLEANUP_TYPE.NORMAL);
    },
    events: {
      connectTimeout: function () {
        // Do nothing, as the timer should be cleaned up.
      },
      message: function () {
        // Do nothing
      },
      socketError: function () {
        // Do nothing
      }
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfY3J5cHRvIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsInJlcXVpcmUiLCJfb3MiLCJ0bHMiLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsIm5ldCIsIl9kbnMiLCJfY29uc3RhbnRzIiwiX3N0cmVhbSIsIl9pZGVudGl0eSIsIl9jb3JlQXV0aCIsIl9idWxrTG9hZCIsIl9kZWJ1ZyIsIl9ldmVudHMiLCJfaW5zdGFuY2VMb29rdXAiLCJfdHJhbnNpZW50RXJyb3JMb29rdXAiLCJfcGFja2V0IiwiX3ByZWxvZ2luUGF5bG9hZCIsIl9sb2dpbjdQYXlsb2FkIiwiX250bG1QYXlsb2FkIiwiX3JlcXVlc3QiLCJfcnBjcmVxdWVzdFBheWxvYWQiLCJfc3FsYmF0Y2hQYXlsb2FkIiwiX21lc3NhZ2VJbyIsIl90b2tlblN0cmVhbVBhcnNlciIsIl90cmFuc2FjdGlvbiIsIl9lcnJvcnMiLCJfY29ubmVjdG9yIiwiX2xpYnJhcnkiLCJfdGRzVmVyc2lvbnMiLCJfbWVzc2FnZSIsIl9udGxtIiwiX2RhdGFUeXBlIiwiX2J1bGtMb2FkUGF5bG9hZCIsIl9zcGVjaWFsU3RvcmVkUHJvY2VkdXJlIiwiX3BhY2thZ2UiLCJfdXJsIiwiX2hhbmRsZXIiLCJfZ2V0UmVxdWlyZVdpbGRjYXJkQ2FjaGUiLCJlIiwiV2Vha01hcCIsInIiLCJ0IiwiX19lc01vZHVsZSIsImRlZmF1bHQiLCJoYXMiLCJnZXQiLCJuIiwiX19wcm90b19fIiwiYSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwidSIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImkiLCJzZXQiLCJvYmoiLCJLRUVQX0FMSVZFX0lOSVRJQUxfREVMQVkiLCJERUZBVUxUX0NPTk5FQ1RfVElNRU9VVCIsIkRFRkFVTFRfQ0xJRU5UX1JFUVVFU1RfVElNRU9VVCIsIkRFRkFVTFRfQ0FOQ0VMX1RJTUVPVVQiLCJERUZBVUxUX0NPTk5FQ1RfUkVUUllfSU5URVJWQUwiLCJERUZBVUxUX1BBQ0tFVF9TSVpFIiwiREVGQVVMVF9URVhUU0laRSIsIkRFRkFVTFRfREFURUZJUlNUIiwiREVGQVVMVF9QT1JUIiwiREVGQVVMVF9URFNfVkVSU0lPTiIsIkRFRkFVTFRfTEFOR1VBR0UiLCJERUZBVUxUX0RBVEVGT1JNQVQiLCJDTEVBTlVQX1RZUEUiLCJOT1JNQUwiLCJSRURJUkVDVCIsIlJFVFJZIiwiQ29ubmVjdGlvbiIsIkV2ZW50RW1pdHRlciIsIl9jYW5jZWxBZnRlclJlcXVlc3RTZW50IiwiY29uc3RydWN0b3IiLCJjb25maWciLCJUeXBlRXJyb3IiLCJzZXJ2ZXIiLCJmZWRBdXRoUmVxdWlyZWQiLCJhdXRoZW50aWNhdGlvbiIsInVuZGVmaW5lZCIsInR5cGUiLCJvcHRpb25zIiwiZG9tYWluIiwidXNlck5hbWUiLCJwYXNzd29yZCIsInRvVXBwZXJDYXNlIiwiaXNUb2tlbkNyZWRlbnRpYWwiLCJjcmVkZW50aWFsIiwiY2xpZW50SWQiLCJ0ZW5hbnRJZCIsInRva2VuIiwiY2xpZW50U2VjcmV0IiwiYWJvcnRUcmFuc2FjdGlvbk9uRXJyb3IiLCJhcHBOYW1lIiwiY2FtZWxDYXNlQ29sdW1ucyIsImNhbmNlbFRpbWVvdXQiLCJjb2x1bW5FbmNyeXB0aW9uS2V5Q2FjaGVUVEwiLCJjb2x1bW5FbmNyeXB0aW9uU2V0dGluZyIsImNvbHVtbk5hbWVSZXBsYWNlciIsImNvbm5lY3Rpb25SZXRyeUludGVydmFsIiwiY29ubmVjdFRpbWVvdXQiLCJjb25uZWN0b3IiLCJjb25uZWN0aW9uSXNvbGF0aW9uTGV2ZWwiLCJJU09MQVRJT05fTEVWRUwiLCJSRUFEX0NPTU1JVFRFRCIsImNyeXB0b0NyZWRlbnRpYWxzRGV0YWlscyIsImRhdGFiYXNlIiwiZGF0ZWZpcnN0IiwiZGF0ZUZvcm1hdCIsImRlYnVnIiwiZGF0YSIsInBhY2tldCIsInBheWxvYWQiLCJlbmFibGVBbnNpTnVsbCIsImVuYWJsZUFuc2lOdWxsRGVmYXVsdCIsImVuYWJsZUFuc2lQYWRkaW5nIiwiZW5hYmxlQW5zaVdhcm5pbmdzIiwiZW5hYmxlQXJpdGhBYm9ydCIsImVuYWJsZUNvbmNhdE51bGxZaWVsZHNOdWxsIiwiZW5hYmxlQ3Vyc29yQ2xvc2VPbkNvbW1pdCIsImVuYWJsZUltcGxpY2l0VHJhbnNhY3Rpb25zIiwiZW5hYmxlTnVtZXJpY1JvdW5kYWJvcnQiLCJlbmFibGVRdW90ZWRJZGVudGlmaWVyIiwiZW5jcnlwdCIsImZhbGxiYWNrVG9EZWZhdWx0RGIiLCJlbmNyeXB0aW9uS2V5U3RvcmVQcm92aWRlcnMiLCJpbnN0YW5jZU5hbWUiLCJpc29sYXRpb25MZXZlbCIsImxhbmd1YWdlIiwibG9jYWxBZGRyZXNzIiwibWF4UmV0cmllc09uVHJhbnNpZW50RXJyb3JzIiwibXVsdGlTdWJuZXRGYWlsb3ZlciIsInBhY2tldFNpemUiLCJwb3J0IiwicmVhZE9ubHlJbnRlbnQiLCJyZXF1ZXN0VGltZW91dCIsInJvd0NvbGxlY3Rpb25PbkRvbmUiLCJyb3dDb2xsZWN0aW9uT25SZXF1ZXN0Q29tcGxldGlvbiIsInNlcnZlck5hbWUiLCJzZXJ2ZXJTdXBwb3J0c0NvbHVtbkVuY3J5cHRpb24iLCJ0ZHNWZXJzaW9uIiwidGV4dHNpemUiLCJ0cnVzdGVkU2VydmVyTmFtZUFFIiwidHJ1c3RTZXJ2ZXJDZXJ0aWZpY2F0ZSIsInVzZUNvbHVtbk5hbWVzIiwidXNlVVRDIiwid29ya3N0YXRpb25JZCIsImxvd2VyQ2FzZUd1aWRzIiwiRXJyb3IiLCJhc3NlcnRWYWxpZElzb2xhdGlvbkxldmVsIiwiUmFuZ2VFcnJvciIsInNlY3VyZUNvbnRleHRPcHRpb25zIiwic2VjdXJlT3B0aW9ucyIsImNyZWF0ZSIsInZhbHVlIiwiY29uc3RhbnRzIiwiU1NMX09QX0RPTlRfSU5TRVJUX0VNUFRZX0ZSQUdNRU5UUyIsImNyZWF0ZURlYnVnIiwiaW5UcmFuc2FjdGlvbiIsInRyYW5zYWN0aW9uRGVzY3JpcHRvcnMiLCJCdWZmZXIiLCJmcm9tIiwidHJhbnNhY3Rpb25EZXB0aCIsImlzU3FsQmF0Y2giLCJjbG9zZWQiLCJtZXNzYWdlQnVmZmVyIiwiYWxsb2MiLCJjdXJUcmFuc2llbnRSZXRyeUNvdW50IiwidHJhbnNpZW50RXJyb3JMb29rdXAiLCJUcmFuc2llbnRFcnJvckxvb2t1cCIsInN0YXRlIiwiU1RBVEUiLCJJTklUSUFMSVpFRCIsIm1lc3NhZ2VJbyIsInNlbmRNZXNzYWdlIiwiVFlQRSIsIkFUVEVOVElPTiIsImNyZWF0ZUNhbmNlbFRpbWVyIiwiY29ubmVjdCIsImNvbm5lY3RMaXN0ZW5lciIsIkNvbm5lY3Rpb25FcnJvciIsIm5hbWUiLCJvbkNvbm5lY3QiLCJlcnIiLCJyZW1vdmVMaXN0ZW5lciIsIm9uRXJyb3IiLCJvbmNlIiwidHJhbnNpdGlvblRvIiwiQ09OTkVDVElORyIsIm9uIiwiZXZlbnQiLCJsaXN0ZW5lciIsImVtaXQiLCJhcmdzIiwiY2xvc2UiLCJGSU5BTCIsImluaXRpYWxpc2VDb25uZWN0aW9uIiwic2lnbmFsIiwiY3JlYXRlQ29ubmVjdFRpbWVyIiwiY29ubmVjdE9uUG9ydCIsImluc3RhbmNlTG9va3VwIiwidGltZW91dCIsInRoZW4iLCJwcm9jZXNzIiwibmV4dFRpY2siLCJjbGVhckNvbm5lY3RUaW1lciIsImFib3J0ZWQiLCJtZXNzYWdlIiwiY2F1c2UiLCJjbGVhbnVwQ29ubmVjdGlvbiIsImNsZWFudXBUeXBlIiwiY2xlYXJSZXF1ZXN0VGltZXIiLCJjbGVhclJldHJ5VGltZXIiLCJjbG9zZUNvbm5lY3Rpb24iLCJyZXF1ZXN0IiwiUmVxdWVzdEVycm9yIiwiY2FsbGJhY2siLCJsb2dpbkVycm9yIiwiRGVidWciLCJjcmVhdGVUb2tlblN0cmVhbVBhcnNlciIsImhhbmRsZXIiLCJUb2tlblN0cmVhbVBhcnNlciIsInNvY2tldEhhbmRsaW5nRm9yU2VuZFByZUxvZ2luIiwic29ja2V0IiwiZXJyb3IiLCJzb2NrZXRFcnJvciIsInNvY2tldENsb3NlIiwic29ja2V0RW5kIiwic2V0S2VlcEFsaXZlIiwiTWVzc2FnZUlPIiwiY2xlYXJ0ZXh0IiwibG9nIiwic2VuZFByZUxvZ2luIiwiU0VOVF9QUkVMT0dJTiIsIndyYXBXaXRoVGxzIiwidGhyb3dJZkFib3J0ZWQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInNlY3VyZUNvbnRleHQiLCJjcmVhdGVTZWN1cmVDb250ZXh0IiwiaXNJUCIsImVuY3J5cHRPcHRpb25zIiwiaG9zdCIsIkFMUE5Qcm90b2NvbHMiLCJzZXJ2ZXJuYW1lIiwiZW5jcnlwdHNvY2tldCIsIm9uQWJvcnQiLCJkZXN0cm95IiwicmVhc29uIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImFkZEV2ZW50TGlzdGVuZXIiLCJjdXN0b21Db25uZWN0b3IiLCJjb25uZWN0T3B0cyIsInJvdXRpbmdEYXRhIiwiY29ubmVjdEluUGFyYWxsZWwiLCJjb25uZWN0SW5TZXF1ZW5jZSIsImRucyIsImxvb2t1cCIsImVuZCIsImNhdGNoIiwiY29udHJvbGxlciIsIkFib3J0Q29udHJvbGxlciIsImNvbm5lY3RUaW1lciIsInNldFRpbWVvdXQiLCJhYm9ydCIsImNsZWFyQ2FuY2VsVGltZXIiLCJjYW5jZWxUaW1lciIsImNyZWF0ZVJlcXVlc3RUaW1lciIsInJlcXVlc3RUaW1lciIsImNyZWF0ZVJldHJ5VGltZXIiLCJyZXRyeVRpbWVyIiwicmV0cnlUaW1lb3V0IiwiaG9zdFBvc3RmaXgiLCJyb3V0aW5nTWVzc2FnZSIsImRpc3BhdGNoRXZlbnQiLCJjYW5jZWwiLCJjbGVhclRpbWVvdXQiLCJuZXdTdGF0ZSIsImV4aXQiLCJlbnRlciIsImFwcGx5IiwiZ2V0RXZlbnRIYW5kbGVyIiwiZXZlbnROYW1lIiwiZXZlbnRzIiwiU0VOVF9UTFNTU0xORUdPVElBVElPTiIsImNvZGUiLCJSRVJPVVRJTkciLCJUUkFOU0lFTlRfRkFJTFVSRV9SRVRSWSIsIm1ham9yIiwibWlub3IiLCJidWlsZCIsImV4ZWMiLCJ2ZXJzaW9uIiwiUHJlbG9naW5QYXlsb2FkIiwiTnVtYmVyIiwic3ViYnVpbGQiLCJQUkVMT0dJTiIsInRvU3RyaW5nIiwic2VuZExvZ2luN1BhY2tldCIsIkxvZ2luN1BheWxvYWQiLCJ2ZXJzaW9ucyIsImNsaWVudFByb2dWZXIiLCJjbGllbnRQaWQiLCJwaWQiLCJjb25uZWN0aW9uSWQiLCJjbGllbnRUaW1lWm9uZSIsIkRhdGUiLCJnZXRUaW1lem9uZU9mZnNldCIsImNsaWVudExjaWQiLCJmZWRBdXRoIiwiZWNobyIsIndvcmtmbG93IiwiZmVkQXV0aFRva2VuIiwic3NwaSIsImNyZWF0ZU5UTE1SZXF1ZXN0IiwiaG9zdG5hbWUiLCJvcyIsImxpYnJhcnlOYW1lIiwiaW5pdERiRmF0YWwiLCJMT0dJTjciLCJ0b0J1ZmZlciIsInNlbmRGZWRBdXRoVG9rZW5NZXNzYWdlIiwiYWNjZXNzVG9rZW5MZW4iLCJieXRlTGVuZ3RoIiwib2Zmc2V0Iiwid3JpdGVVSW50MzJMRSIsIndyaXRlIiwiRkVEQVVUSF9UT0tFTiIsIlNFTlRfTE9HSU43X1dJVEhfU1RBTkRBUkRfTE9HSU4iLCJzZW5kSW5pdGlhbFNxbCIsIlNxbEJhdGNoUGF5bG9hZCIsImdldEluaXRpYWxTcWwiLCJjdXJyZW50VHJhbnNhY3Rpb25EZXNjcmlwdG9yIiwiTWVzc2FnZSIsIlNRTF9CQVRDSCIsIm91dGdvaW5nTWVzc2FnZVN0cmVhbSIsIlJlYWRhYmxlIiwicGlwZSIsInB1c2giLCJnZXRJc29sYXRpb25MZXZlbFRleHQiLCJqb2luIiwicHJvY2Vzc2VkSW5pdGlhbFNxbCIsImV4ZWNTcWxCYXRjaCIsIm1ha2VSZXF1ZXN0Iiwic3FsVGV4dE9yUHJvY2VkdXJlIiwiZXhlY1NxbCIsInZhbGlkYXRlUGFyYW1ldGVycyIsImRhdGFiYXNlQ29sbGF0aW9uIiwicGFyYW1ldGVycyIsIlRZUEVTIiwiTlZhckNoYXIiLCJvdXRwdXQiLCJsZW5ndGgiLCJwcmVjaXNpb24iLCJzY2FsZSIsIm1ha2VQYXJhbXNQYXJhbWV0ZXIiLCJSUENfUkVRVUVTVCIsIlJwY1JlcXVlc3RQYXlsb2FkIiwiUHJvY2VkdXJlcyIsIlNwX0V4ZWN1dGVTcWwiLCJuZXdCdWxrTG9hZCIsInRhYmxlIiwiY2FsbGJhY2tPck9wdGlvbnMiLCJCdWxrTG9hZCIsImV4ZWNCdWxrTG9hZCIsImJ1bGtMb2FkIiwicm93cyIsImV4ZWN1dGlvblN0YXJ0ZWQiLCJzdHJlYW1pbmdNb2RlIiwiZmlyc3RSb3dXcml0dGVuIiwicm93U3RyZWFtIiwicm93VG9QYWNrZXRUcmFuc2Zvcm0iLCJvbkNhbmNlbCIsIkJ1bGtMb2FkUGF5bG9hZCIsIlJlcXVlc3QiLCJnZXRCdWxrSW5zZXJ0U3FsIiwiQlVMS19MT0FEIiwicHJlcGFyZSIsIkludCIsInByZXBhcmluZyIsImhhbmRsZSIsIlNwX1ByZXBhcmUiLCJ1bnByZXBhcmUiLCJTcF9VbnByZXBhcmUiLCJleGVjdXRlIiwiZXhlY3V0ZVBhcmFtZXRlcnMiLCJsZW4iLCJwYXJhbWV0ZXIiLCJ2YWxpZGF0ZSIsIlNwX0V4ZWN1dGUiLCJjYWxsUHJvY2VkdXJlIiwiYmVnaW5UcmFuc2FjdGlvbiIsInRyYW5zYWN0aW9uIiwiVHJhbnNhY3Rpb24iLCJpc29sYXRpb25MZXZlbFRvVFNRTCIsIlRSQU5TQUNUSU9OX01BTkFHRVIiLCJiZWdpblBheWxvYWQiLCJjb21taXRUcmFuc2FjdGlvbiIsImNvbW1pdFBheWxvYWQiLCJyb2xsYmFja1RyYW5zYWN0aW9uIiwicm9sbGJhY2tQYXlsb2FkIiwic2F2ZVRyYW5zYWN0aW9uIiwic2F2ZVBheWxvYWQiLCJjYiIsInVzZVNhdmVwb2ludCIsImNyeXB0byIsInJhbmRvbUJ5dGVzIiwidHhEb25lIiwiZG9uZSIsIkxPR0dFRF9JTiIsInR4RXJyIiwicGFja2V0VHlwZSIsImNhbmNlbGVkIiwiY29ubmVjdGlvbiIsInJvd0NvdW50IiwicnN0IiwicGF5bG9hZFN0cmVhbSIsInVucGlwZSIsImlnbm9yZSIsInBhdXNlZCIsInJlc3VtZSIsInJlc2V0Q29ubmVjdGlvbiIsInJlc2V0Q29ubmVjdGlvbk9uTmV4dFJlcXVlc3QiLCJTRU5UX0NMSUVOVF9SRVFVRVNUIiwicmVzZXQiLCJSRUFEX1VOQ09NTUlUVEVEIiwiUkVQRUFUQUJMRV9SRUFEIiwiU0VSSUFMSVpBQkxFIiwiU05BUFNIT1QiLCJpc1RyYW5zaWVudEVycm9yIiwiQWdncmVnYXRlRXJyb3IiLCJlcnJvcnMiLCJpc1RyYW5zaWVudCIsIl9kZWZhdWx0IiwiZXhwb3J0cyIsIm1vZHVsZSIsInJlYWRNZXNzYWdlIiwiY29uY2F0IiwicHJlbG9naW5QYXlsb2FkIiwiZW5jcnlwdGlvblN0cmluZyIsInN0YXJ0VGxzIiwiU0VOVF9MT0dJTjdfV0lUSF9GRURBVVRIIiwiU0VOVF9MT0dJTjdfV0lUSF9OVExNIiwicmVjb25uZWN0IiwicmV0cnkiLCJMb2dpbjdUb2tlbkhhbmRsZXIiLCJ0b2tlblN0cmVhbVBhcnNlciIsImxvZ2luQWNrUmVjZWl2ZWQiLCJMT0dHRURfSU5fU0VORElOR19JTklUSUFMX1NRTCIsIm50bG1wYWNrZXQiLCJOVExNUmVzcG9uc2VQYXlsb2FkIiwiTlRMTUFVVEhfUEtUIiwiZmVkQXV0aEluZm9Ub2tlbiIsInN0c3VybCIsInNwbiIsInRva2VuU2NvcGUiLCJVUkwiLCJjcmVkZW50aWFscyIsIlVzZXJuYW1lUGFzc3dvcmRDcmVkZW50aWFsIiwibXNpQXJncyIsIk1hbmFnZWRJZGVudGl0eUNyZWRlbnRpYWwiLCJtYW5hZ2VkSWRlbnRpdHlDbGllbnRJZCIsIkRlZmF1bHRBenVyZUNyZWRlbnRpYWwiLCJDbGllbnRTZWNyZXRDcmVkZW50aWFsIiwidG9rZW5SZXNwb25zZSIsImdldFRva2VuIiwiSW5pdGlhbFNxbFRva2VuSGFuZGxlciIsIlJlcXVlc3RUb2tlbkhhbmRsZXIiLCJTRU5UX0FUVEVOVElPTiIsIm9uUmVzdW1lIiwib25QYXVzZSIsInBhdXNlIiwib25FbmRPZk1lc3NhZ2UiLCJzcWxSZXF1ZXN0IiwibmV4dFN0YXRlIiwiQXR0ZW50aW9uVG9rZW5IYW5kbGVyIiwiYXR0ZW50aW9uUmVjZWl2ZWQiXSwic291cmNlcyI6WyIuLi9zcmMvY29ubmVjdGlvbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgdGxzIGZyb20gJ3Rscyc7XG5pbXBvcnQgKiBhcyBuZXQgZnJvbSAnbmV0JztcbmltcG9ydCBkbnMgZnJvbSAnZG5zJztcblxuaW1wb3J0IGNvbnN0YW50cyBmcm9tICdjb25zdGFudHMnO1xuaW1wb3J0IHsgdHlwZSBTZWN1cmVDb250ZXh0T3B0aW9ucyB9IGZyb20gJ3Rscyc7XG5cbmltcG9ydCB7IFJlYWRhYmxlIH0gZnJvbSAnc3RyZWFtJztcblxuaW1wb3J0IHtcbiAgQ2xpZW50U2VjcmV0Q3JlZGVudGlhbCxcbiAgRGVmYXVsdEF6dXJlQ3JlZGVudGlhbCxcbiAgTWFuYWdlZElkZW50aXR5Q3JlZGVudGlhbCxcbiAgVXNlcm5hbWVQYXNzd29yZENyZWRlbnRpYWxcbn0gZnJvbSAnQGF6dXJlL2lkZW50aXR5JztcbmltcG9ydCB7IHR5cGUgQWNjZXNzVG9rZW4sIHR5cGUgVG9rZW5DcmVkZW50aWFsLCBpc1Rva2VuQ3JlZGVudGlhbCB9IGZyb20gJ0BhenVyZS9jb3JlLWF1dGgnO1xuXG5pbXBvcnQgQnVsa0xvYWQsIHsgdHlwZSBPcHRpb25zIGFzIEJ1bGtMb2FkT3B0aW9ucywgdHlwZSBDYWxsYmFjayBhcyBCdWxrTG9hZENhbGxiYWNrIH0gZnJvbSAnLi9idWxrLWxvYWQnO1xuaW1wb3J0IERlYnVnIGZyb20gJy4vZGVidWcnO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyLCBvbmNlIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCB7IGluc3RhbmNlTG9va3VwIH0gZnJvbSAnLi9pbnN0YW5jZS1sb29rdXAnO1xuaW1wb3J0IHsgVHJhbnNpZW50RXJyb3JMb29rdXAgfSBmcm9tICcuL3RyYW5zaWVudC1lcnJvci1sb29rdXAnO1xuaW1wb3J0IHsgVFlQRSB9IGZyb20gJy4vcGFja2V0JztcbmltcG9ydCBQcmVsb2dpblBheWxvYWQgZnJvbSAnLi9wcmVsb2dpbi1wYXlsb2FkJztcbmltcG9ydCBMb2dpbjdQYXlsb2FkIGZyb20gJy4vbG9naW43LXBheWxvYWQnO1xuaW1wb3J0IE5UTE1SZXNwb25zZVBheWxvYWQgZnJvbSAnLi9udGxtLXBheWxvYWQnO1xuaW1wb3J0IFJlcXVlc3QgZnJvbSAnLi9yZXF1ZXN0JztcbmltcG9ydCBScGNSZXF1ZXN0UGF5bG9hZCBmcm9tICcuL3JwY3JlcXVlc3QtcGF5bG9hZCc7XG5pbXBvcnQgU3FsQmF0Y2hQYXlsb2FkIGZyb20gJy4vc3FsYmF0Y2gtcGF5bG9hZCc7XG5pbXBvcnQgTWVzc2FnZUlPIGZyb20gJy4vbWVzc2FnZS1pbyc7XG5pbXBvcnQgeyBQYXJzZXIgYXMgVG9rZW5TdHJlYW1QYXJzZXIgfSBmcm9tICcuL3Rva2VuL3Rva2VuLXN0cmVhbS1wYXJzZXInO1xuaW1wb3J0IHsgVHJhbnNhY3Rpb24sIElTT0xBVElPTl9MRVZFTCwgYXNzZXJ0VmFsaWRJc29sYXRpb25MZXZlbCB9IGZyb20gJy4vdHJhbnNhY3Rpb24nO1xuaW1wb3J0IHsgQ29ubmVjdGlvbkVycm9yLCBSZXF1ZXN0RXJyb3IgfSBmcm9tICcuL2Vycm9ycyc7XG5pbXBvcnQgeyBjb25uZWN0SW5QYXJhbGxlbCwgY29ubmVjdEluU2VxdWVuY2UgfSBmcm9tICcuL2Nvbm5lY3Rvcic7XG5pbXBvcnQgeyBuYW1lIGFzIGxpYnJhcnlOYW1lIH0gZnJvbSAnLi9saWJyYXJ5JztcbmltcG9ydCB7IHZlcnNpb25zIH0gZnJvbSAnLi90ZHMtdmVyc2lvbnMnO1xuaW1wb3J0IE1lc3NhZ2UgZnJvbSAnLi9tZXNzYWdlJztcbmltcG9ydCB7IHR5cGUgTWV0YWRhdGEgfSBmcm9tICcuL21ldGFkYXRhLXBhcnNlcic7XG5pbXBvcnQgeyBjcmVhdGVOVExNUmVxdWVzdCB9IGZyb20gJy4vbnRsbSc7XG5pbXBvcnQgeyBDb2x1bW5FbmNyeXB0aW9uQXp1cmVLZXlWYXVsdFByb3ZpZGVyIH0gZnJvbSAnLi9hbHdheXMtZW5jcnlwdGVkL2tleXN0b3JlLXByb3ZpZGVyLWF6dXJlLWtleS12YXVsdCc7XG5cbmltcG9ydCB7IHR5cGUgUGFyYW1ldGVyLCBUWVBFUyB9IGZyb20gJy4vZGF0YS10eXBlJztcbmltcG9ydCB7IEJ1bGtMb2FkUGF5bG9hZCB9IGZyb20gJy4vYnVsay1sb2FkLXBheWxvYWQnO1xuaW1wb3J0IHsgQ29sbGF0aW9uIH0gZnJvbSAnLi9jb2xsYXRpb24nO1xuaW1wb3J0IFByb2NlZHVyZXMgZnJvbSAnLi9zcGVjaWFsLXN0b3JlZC1wcm9jZWR1cmUnO1xuXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCB7IFVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgeyBBdHRlbnRpb25Ub2tlbkhhbmRsZXIsIEluaXRpYWxTcWxUb2tlbkhhbmRsZXIsIExvZ2luN1Rva2VuSGFuZGxlciwgUmVxdWVzdFRva2VuSGFuZGxlciwgVG9rZW5IYW5kbGVyIH0gZnJvbSAnLi90b2tlbi9oYW5kbGVyJztcblxudHlwZSBCZWdpblRyYW5zYWN0aW9uQ2FsbGJhY2sgPVxuICAvKipcbiAgICogVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSByZXF1ZXN0IHRvIHN0YXJ0IHRoZSB0cmFuc2FjdGlvbiBoYXMgY29tcGxldGVkLFxuICAgKiBlaXRoZXIgc3VjY2Vzc2Z1bGx5IG9yIHdpdGggYW4gZXJyb3IuXG4gICAqIElmIGFuIGVycm9yIG9jY3VycmVkIHRoZW4gYGVycmAgd2lsbCBkZXNjcmliZSB0aGUgZXJyb3IuXG4gICAqXG4gICAqIEFzIG9ubHkgb25lIHJlcXVlc3QgYXQgYSB0aW1lIG1heSBiZSBleGVjdXRlZCBvbiBhIGNvbm5lY3Rpb24sIGFub3RoZXIgcmVxdWVzdCBzaG91bGQgbm90XG4gICAqIGJlIGluaXRpYXRlZCB1bnRpbCB0aGlzIGNhbGxiYWNrIGlzIGNhbGxlZC5cbiAgICpcbiAgICogQHBhcmFtIGVyciBJZiBhbiBlcnJvciBvY2N1cnJlZCwgYW4gW1tFcnJvcl1dIG9iamVjdCB3aXRoIGRldGFpbHMgb2YgdGhlIGVycm9yLlxuICAgKiBAcGFyYW0gdHJhbnNhY3Rpb25EZXNjcmlwdG9yIEEgQnVmZmVyIHRoYXQgZGVzY3JpYmUgdGhlIHRyYW5zYWN0aW9uXG4gICAqL1xuICAoZXJyOiBFcnJvciB8IG51bGwgfCB1bmRlZmluZWQsIHRyYW5zYWN0aW9uRGVzY3JpcHRvcj86IEJ1ZmZlcikgPT4gdm9pZFxuXG50eXBlIFNhdmVUcmFuc2FjdGlvbkNhbGxiYWNrID1cbiAgLyoqXG4gICAqIFRoZSBjYWxsYmFjayBpcyBjYWxsZWQgd2hlbiB0aGUgcmVxdWVzdCB0byBzZXQgYSBzYXZlcG9pbnQgd2l0aGluIHRoZVxuICAgKiB0cmFuc2FjdGlvbiBoYXMgY29tcGxldGVkLCBlaXRoZXIgc3VjY2Vzc2Z1bGx5IG9yIHdpdGggYW4gZXJyb3IuXG4gICAqIElmIGFuIGVycm9yIG9jY3VycmVkIHRoZW4gYGVycmAgd2lsbCBkZXNjcmliZSB0aGUgZXJyb3IuXG4gICAqXG4gICAqIEFzIG9ubHkgb25lIHJlcXVlc3QgYXQgYSB0aW1lIG1heSBiZSBleGVjdXRlZCBvbiBhIGNvbm5lY3Rpb24sIGFub3RoZXIgcmVxdWVzdCBzaG91bGQgbm90XG4gICAqIGJlIGluaXRpYXRlZCB1bnRpbCB0aGlzIGNhbGxiYWNrIGlzIGNhbGxlZC5cbiAgICpcbiAgICogQHBhcmFtIGVyciBJZiBhbiBlcnJvciBvY2N1cnJlZCwgYW4gW1tFcnJvcl1dIG9iamVjdCB3aXRoIGRldGFpbHMgb2YgdGhlIGVycm9yLlxuICAgKi9cbiAgKGVycjogRXJyb3IgfCBudWxsIHwgdW5kZWZpbmVkKSA9PiB2b2lkO1xuXG50eXBlIENvbW1pdFRyYW5zYWN0aW9uQ2FsbGJhY2sgPVxuICAvKipcbiAgICogVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSByZXF1ZXN0IHRvIGNvbW1pdCB0aGUgdHJhbnNhY3Rpb24gaGFzIGNvbXBsZXRlZCxcbiAgICogZWl0aGVyIHN1Y2Nlc3NmdWxseSBvciB3aXRoIGFuIGVycm9yLlxuICAgKiBJZiBhbiBlcnJvciBvY2N1cnJlZCB0aGVuIGBlcnJgIHdpbGwgZGVzY3JpYmUgdGhlIGVycm9yLlxuICAgKlxuICAgKiBBcyBvbmx5IG9uZSByZXF1ZXN0IGF0IGEgdGltZSBtYXkgYmUgZXhlY3V0ZWQgb24gYSBjb25uZWN0aW9uLCBhbm90aGVyIHJlcXVlc3Qgc2hvdWxkIG5vdFxuICAgKiBiZSBpbml0aWF0ZWQgdW50aWwgdGhpcyBjYWxsYmFjayBpcyBjYWxsZWQuXG4gICAqXG4gICAqIEBwYXJhbSBlcnIgSWYgYW4gZXJyb3Igb2NjdXJyZWQsIGFuIFtbRXJyb3JdXSBvYmplY3Qgd2l0aCBkZXRhaWxzIG9mIHRoZSBlcnJvci5cbiAgICovXG4gIChlcnI6IEVycm9yIHwgbnVsbCB8IHVuZGVmaW5lZCkgPT4gdm9pZDtcblxudHlwZSBSb2xsYmFja1RyYW5zYWN0aW9uQ2FsbGJhY2sgPVxuICAvKipcbiAgICogVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSByZXF1ZXN0IHRvIHJvbGxiYWNrIHRoZSB0cmFuc2FjdGlvbiBoYXNcbiAgICogY29tcGxldGVkLCBlaXRoZXIgc3VjY2Vzc2Z1bGx5IG9yIHdpdGggYW4gZXJyb3IuXG4gICAqIElmIGFuIGVycm9yIG9jY3VycmVkIHRoZW4gZXJyIHdpbGwgZGVzY3JpYmUgdGhlIGVycm9yLlxuICAgKlxuICAgKiBBcyBvbmx5IG9uZSByZXF1ZXN0IGF0IGEgdGltZSBtYXkgYmUgZXhlY3V0ZWQgb24gYSBjb25uZWN0aW9uLCBhbm90aGVyIHJlcXVlc3Qgc2hvdWxkIG5vdFxuICAgKiBiZSBpbml0aWF0ZWQgdW50aWwgdGhpcyBjYWxsYmFjayBpcyBjYWxsZWQuXG4gICAqXG4gICAqIEBwYXJhbSBlcnIgSWYgYW4gZXJyb3Igb2NjdXJyZWQsIGFuIFtbRXJyb3JdXSBvYmplY3Qgd2l0aCBkZXRhaWxzIG9mIHRoZSBlcnJvci5cbiAgICovXG4gIChlcnI6IEVycm9yIHwgbnVsbCB8IHVuZGVmaW5lZCkgPT4gdm9pZDtcblxudHlwZSBSZXNldENhbGxiYWNrID1cbiAgLyoqXG4gICAqIFRoZSBjYWxsYmFjayBpcyBjYWxsZWQgd2hlbiB0aGUgY29ubmVjdGlvbiByZXNldCBoYXMgY29tcGxldGVkLFxuICAgKiBlaXRoZXIgc3VjY2Vzc2Z1bGx5IG9yIHdpdGggYW4gZXJyb3IuXG4gICAqXG4gICAqIElmIGFuIGVycm9yIG9jY3VycmVkIHRoZW4gYGVycmAgd2lsbCBkZXNjcmliZSB0aGUgZXJyb3IuXG4gICAqXG4gICAqIEFzIG9ubHkgb25lIHJlcXVlc3QgYXQgYSB0aW1lIG1heSBiZSBleGVjdXRlZCBvbiBhIGNvbm5lY3Rpb24sIGFub3RoZXJcbiAgICogcmVxdWVzdCBzaG91bGQgbm90IGJlIGluaXRpYXRlZCB1bnRpbCB0aGlzIGNhbGxiYWNrIGlzIGNhbGxlZFxuICAgKlxuICAgKiBAcGFyYW0gZXJyIElmIGFuIGVycm9yIG9jY3VycmVkLCBhbiBbW0Vycm9yXV0gb2JqZWN0IHdpdGggZGV0YWlscyBvZiB0aGUgZXJyb3IuXG4gICAqL1xuICAoZXJyOiBFcnJvciB8IG51bGwgfCB1bmRlZmluZWQpID0+IHZvaWQ7XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbnR5cGUgVHJhbnNhY3Rpb25DYWxsYmFjazxUIGV4dGVuZHMgKGVycjogRXJyb3IgfCBudWxsIHwgdW5kZWZpbmVkLCAuLi5hcmdzOiBhbnlbXSkgPT4gdm9pZD4gPVxuICAvKipcbiAgICogVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSByZXF1ZXN0IHRvIHN0YXJ0IGEgdHJhbnNhY3Rpb24gKG9yIGNyZWF0ZSBhIHNhdmVwb2ludCwgaW5cbiAgICogdGhlIGNhc2Ugb2YgYSBuZXN0ZWQgdHJhbnNhY3Rpb24pIGhhcyBjb21wbGV0ZWQsIGVpdGhlciBzdWNjZXNzZnVsbHkgb3Igd2l0aCBhbiBlcnJvci5cbiAgICogSWYgYW4gZXJyb3Igb2NjdXJyZWQsIHRoZW4gYGVycmAgd2lsbCBkZXNjcmliZSB0aGUgZXJyb3IuXG4gICAqIElmIG5vIGVycm9yIG9jY3VycmVkLCB0aGUgY2FsbGJhY2sgc2hvdWxkIHBlcmZvcm0gaXRzIHdvcmsgYW5kIGV2ZW50dWFsbHkgY2FsbFxuICAgKiBgZG9uZWAgd2l0aCBhbiBlcnJvciBvciBudWxsICh0byB0cmlnZ2VyIGEgdHJhbnNhY3Rpb24gcm9sbGJhY2sgb3IgYVxuICAgKiB0cmFuc2FjdGlvbiBjb21taXQpIGFuZCBhbiBhZGRpdGlvbmFsIGNvbXBsZXRpb24gY2FsbGJhY2sgdGhhdCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZSByZXF1ZXN0XG4gICAqIHRvIHJvbGxiYWNrIG9yIGNvbW1pdCB0aGUgY3VycmVudCB0cmFuc2FjdGlvbiBoYXMgY29tcGxldGVkLCBlaXRoZXIgc3VjY2Vzc2Z1bGx5IG9yIHdpdGggYW4gZXJyb3IuXG4gICAqIEFkZGl0aW9uYWwgYXJndW1lbnRzIGdpdmVuIHRvIGBkb25lYCB3aWxsIGJlIHBhc3NlZCB0aHJvdWdoIHRvIHRoaXMgY2FsbGJhY2suXG4gICAqXG4gICAqIEFzIG9ubHkgb25lIHJlcXVlc3QgYXQgYSB0aW1lIG1heSBiZSBleGVjdXRlZCBvbiBhIGNvbm5lY3Rpb24sIGFub3RoZXIgcmVxdWVzdCBzaG91bGQgbm90XG4gICAqIGJlIGluaXRpYXRlZCB1bnRpbCB0aGUgY29tcGxldGlvbiBjYWxsYmFjayBpcyBjYWxsZWQuXG4gICAqXG4gICAqIEBwYXJhbSBlcnIgSWYgYW4gZXJyb3Igb2NjdXJyZWQsIGFuIFtbRXJyb3JdXSBvYmplY3Qgd2l0aCBkZXRhaWxzIG9mIHRoZSBlcnJvci5cbiAgICogQHBhcmFtIHR4RG9uZSBJZiBubyBlcnJvciBvY2N1cnJlZCwgYSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgdG8gY29tbWl0IG9yIHJvbGxiYWNrIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIChlcnI6IEVycm9yIHwgbnVsbCB8IHVuZGVmaW5lZCwgdHhEb25lPzogVHJhbnNhY3Rpb25Eb25lPFQ+KSA9PiB2b2lkO1xuXG50eXBlIFRyYW5zYWN0aW9uRG9uZUNhbGxiYWNrID0gKGVycjogRXJyb3IgfCBudWxsIHwgdW5kZWZpbmVkLCAuLi5hcmdzOiBhbnlbXSkgPT4gdm9pZDtcbnR5cGUgQ2FsbGJhY2tQYXJhbWV0ZXJzPFQgZXh0ZW5kcyAoZXJyOiBFcnJvciB8IG51bGwgfCB1bmRlZmluZWQsIC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+ID0gVCBleHRlbmRzIChlcnI6IEVycm9yIHwgbnVsbCB8IHVuZGVmaW5lZCwgLi4uYXJnczogaW5mZXIgUCkgPT4gYW55ID8gUCA6IG5ldmVyO1xuXG50eXBlIFRyYW5zYWN0aW9uRG9uZTxUIGV4dGVuZHMgKGVycjogRXJyb3IgfCBudWxsIHwgdW5kZWZpbmVkLCAuLi5hcmdzOiBhbnlbXSkgPT4gdm9pZD4gPVxuICAvKipcbiAgICogSWYgbm8gZXJyb3Igb2NjdXJyZWQsIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHRvIGNvbW1pdCBvciByb2xsYmFjayB0aGUgdHJhbnNhY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSBlcnIgSWYgYW4gZXJyIG9jY3VycmVkLCBhIHN0cmluZyB3aXRoIGRldGFpbHMgb2YgdGhlIGVycm9yLlxuICAgKi9cbiAgKGVycjogRXJyb3IgfCBudWxsIHwgdW5kZWZpbmVkLCBkb25lOiBULCAuLi5hcmdzOiBDYWxsYmFja1BhcmFtZXRlcnM8VD4pID0+IHZvaWQ7XG5cbi8qKlxuICogQHByaXZhdGVcbiAqL1xuY29uc3QgS0VFUF9BTElWRV9JTklUSUFMX0RFTEFZID0gMzAgKiAxMDAwO1xuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5jb25zdCBERUZBVUxUX0NPTk5FQ1RfVElNRU9VVCA9IDE1ICogMTAwMDtcbi8qKlxuICogQHByaXZhdGVcbiAqL1xuY29uc3QgREVGQVVMVF9DTElFTlRfUkVRVUVTVF9USU1FT1VUID0gMTUgKiAxMDAwO1xuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5jb25zdCBERUZBVUxUX0NBTkNFTF9USU1FT1VUID0gNSAqIDEwMDA7XG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmNvbnN0IERFRkFVTFRfQ09OTkVDVF9SRVRSWV9JTlRFUlZBTCA9IDUwMDtcbi8qKlxuICogQHByaXZhdGVcbiAqL1xuY29uc3QgREVGQVVMVF9QQUNLRVRfU0laRSA9IDQgKiAxMDI0O1xuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5jb25zdCBERUZBVUxUX1RFWFRTSVpFID0gMjE0NzQ4MzY0Nztcbi8qKlxuICogQHByaXZhdGVcbiAqL1xuY29uc3QgREVGQVVMVF9EQVRFRklSU1QgPSA3O1xuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5jb25zdCBERUZBVUxUX1BPUlQgPSAxNDMzO1xuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5jb25zdCBERUZBVUxUX1REU19WRVJTSU9OID0gJzdfNCc7XG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmNvbnN0IERFRkFVTFRfTEFOR1VBR0UgPSAndXNfZW5nbGlzaCc7XG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmNvbnN0IERFRkFVTFRfREFURUZPUk1BVCA9ICdtZHknO1xuXG5pbnRlcmZhY2UgQXp1cmVBY3RpdmVEaXJlY3RvcnlNc2lBcHBTZXJ2aWNlQXV0aGVudGljYXRpb24ge1xuICB0eXBlOiAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1tc2ktYXBwLXNlcnZpY2UnO1xuICBvcHRpb25zOiB7XG4gICAgLyoqXG4gICAgICogSWYgeW91IHVzZXIgd2FudCB0byBjb25uZWN0IHRvIGFuIEF6dXJlIGFwcCBzZXJ2aWNlIHVzaW5nIGEgc3BlY2lmaWMgY2xpZW50IGFjY291bnRcbiAgICAgKiB0aGV5IG5lZWQgdG8gcHJvdmlkZSBgY2xpZW50SWRgIGFzc29jaWF0ZSB0byB0aGVpciBjcmVhdGVkIGlkZW50aXR5LlxuICAgICAqXG4gICAgICogVGhpcyBpcyBvcHRpb25hbCBmb3IgcmV0cmlldmUgdG9rZW4gZnJvbSBhenVyZSB3ZWIgYXBwIHNlcnZpY2VcbiAgICAgKi9cbiAgICBjbGllbnRJZD86IHN0cmluZztcbiAgfTtcbn1cblxuaW50ZXJmYWNlIEF6dXJlQWN0aXZlRGlyZWN0b3J5TXNpVm1BdXRoZW50aWNhdGlvbiB7XG4gIHR5cGU6ICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LW1zaS12bSc7XG4gIG9wdGlvbnM6IHtcbiAgICAvKipcbiAgICAgKiBJZiB5b3Ugd2FudCB0byBjb25uZWN0IHVzaW5nIGEgc3BlY2lmaWMgY2xpZW50IGFjY291bnRcbiAgICAgKiB0aGV5IG5lZWQgdG8gcHJvdmlkZSBgY2xpZW50SWRgIGFzc29jaWF0ZWQgdG8gdGhlaXIgY3JlYXRlZCBpZGVudGl0eS5cbiAgICAgKlxuICAgICAqIFRoaXMgaXMgb3B0aW9uYWwgZm9yIHJldHJpZXZlIGEgdG9rZW5cbiAgICAgKi9cbiAgICBjbGllbnRJZD86IHN0cmluZztcbiAgfTtcbn1cblxuaW50ZXJmYWNlIEF6dXJlQWN0aXZlRGlyZWN0b3J5RGVmYXVsdEF1dGhlbnRpY2F0aW9uIHtcbiAgdHlwZTogJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktZGVmYXVsdCc7XG4gIG9wdGlvbnM6IHtcbiAgICAvKipcbiAgICAgKiBJZiB5b3Ugd2FudCB0byBjb25uZWN0IHVzaW5nIGEgc3BlY2lmaWMgY2xpZW50IGFjY291bnRcbiAgICAgKiB0aGV5IG5lZWQgdG8gcHJvdmlkZSBgY2xpZW50SWRgIGFzc29jaWF0ZWQgdG8gdGhlaXIgY3JlYXRlZCBpZGVudGl0eS5cbiAgICAgKlxuICAgICAqIFRoaXMgaXMgb3B0aW9uYWwgZm9yIHJldHJpZXZpbmcgYSB0b2tlblxuICAgICAqL1xuICAgIGNsaWVudElkPzogc3RyaW5nO1xuICB9O1xufVxuXG5cbmludGVyZmFjZSBBenVyZUFjdGl2ZURpcmVjdG9yeUFjY2Vzc1Rva2VuQXV0aGVudGljYXRpb24ge1xuICB0eXBlOiAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1hY2Nlc3MtdG9rZW4nO1xuICBvcHRpb25zOiB7XG4gICAgLyoqXG4gICAgICogQSB1c2VyIG5lZWQgdG8gcHJvdmlkZSBgdG9rZW5gIHdoaWNoIHRoZXkgcmV0cmlldmVkIGVsc2Ugd2hlcmVcbiAgICAgKiB0byBmb3JtaW5nIHRoZSBjb25uZWN0aW9uLlxuICAgICAqL1xuICAgIHRva2VuOiBzdHJpbmc7XG4gIH07XG59XG5cbmludGVyZmFjZSBBenVyZUFjdGl2ZURpcmVjdG9yeVBhc3N3b3JkQXV0aGVudGljYXRpb24ge1xuICB0eXBlOiAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1wYXNzd29yZCc7XG4gIG9wdGlvbnM6IHtcbiAgICAvKipcbiAgICAgKiBBIHVzZXIgbmVlZCB0byBwcm92aWRlIGB1c2VyTmFtZWAgYXNzb2NpYXRlIHRvIHRoZWlyIGFjY291bnQuXG4gICAgICovXG4gICAgdXNlck5hbWU6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIEEgdXNlciBuZWVkIHRvIHByb3ZpZGUgYHBhc3N3b3JkYCBhc3NvY2lhdGUgdG8gdGhlaXIgYWNjb3VudC5cbiAgICAgKi9cbiAgICBwYXNzd29yZDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogQSBjbGllbnQgaWQgdG8gdXNlLlxuICAgICAqL1xuICAgIGNsaWVudElkOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBPcHRpb25hbCBwYXJhbWV0ZXIgZm9yIHNwZWNpZmljIEF6dXJlIHRlbmFudCBJRFxuICAgICAqL1xuICAgIHRlbmFudElkOiBzdHJpbmc7XG4gIH07XG59XG5cbmludGVyZmFjZSBBenVyZUFjdGl2ZURpcmVjdG9yeVNlcnZpY2VQcmluY2lwYWxTZWNyZXQge1xuICB0eXBlOiAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1zZXJ2aWNlLXByaW5jaXBhbC1zZWNyZXQnO1xuICBvcHRpb25zOiB7XG4gICAgLyoqXG4gICAgICogQXBwbGljYXRpb24gKGBjbGllbnRgKSBJRCBmcm9tIHlvdXIgcmVnaXN0ZXJlZCBBenVyZSBhcHBsaWNhdGlvblxuICAgICAqL1xuICAgIGNsaWVudElkOiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIGNyZWF0ZWQgYGNsaWVudCBzZWNyZXRgIGZvciB0aGlzIHJlZ2lzdGVyZWQgQXp1cmUgYXBwbGljYXRpb25cbiAgICAgKi9cbiAgICBjbGllbnRTZWNyZXQ6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBEaXJlY3RvcnkgKGB0ZW5hbnRgKSBJRCBmcm9tIHlvdXIgcmVnaXN0ZXJlZCBBenVyZSBhcHBsaWNhdGlvblxuICAgICAqL1xuICAgIHRlbmFudElkOiBzdHJpbmc7XG4gIH07XG59XG5cbi8qKiBTdHJ1Y3R1cmUgdGhhdCBkZWZpbmVzIHRoZSBvcHRpb25zIHRoYXQgYXJlIG5lY2Vzc2FyeSB0byBhdXRoZW50aWNhdGUgdGhlIFRlZGlvdXMuSlMgaW5zdGFuY2Ugd2l0aCBhbiBgQGF6dXJlL2lkZW50aXR5YCB0b2tlbiBjcmVkZW50aWFsLiAqL1xuaW50ZXJmYWNlIFRva2VuQ3JlZGVudGlhbEF1dGhlbnRpY2F0aW9uIHtcbiAgLyoqIFVuaXF1ZSBkZXNpZ25hdG9yIGZvciB0aGUgdHlwZSBvZiBhdXRoZW50aWNhdGlvbiB0byBiZSB1c2VkLiAqL1xuICB0eXBlOiAndG9rZW4tY3JlZGVudGlhbCc7XG4gIC8qKiBTZXQgb2YgY29uZmlndXJhdGlvbnMgdGhhdCBhcmUgcmVxdWlyZWQgb3IgYWxsb3dlZCB3aXRoIHRoaXMgYXV0aGVudGljYXRpb24gdHlwZS4gKi9cbiAgb3B0aW9uczoge1xuICAgIC8qKiBDcmVkZW50aWFsIG9iamVjdCB1c2VkIHRvIGF1dGhlbnRpY2F0ZSB0byB0aGUgcmVzb3VyY2UuICovXG4gICAgY3JlZGVudGlhbDogVG9rZW5DcmVkZW50aWFsO1xuICB9O1xufVxuXG5pbnRlcmZhY2UgTnRsbUF1dGhlbnRpY2F0aW9uIHtcbiAgdHlwZTogJ250bG0nO1xuICBvcHRpb25zOiB7XG4gICAgLyoqXG4gICAgICogVXNlciBuYW1lIGZyb20geW91ciB3aW5kb3dzIGFjY291bnQuXG4gICAgICovXG4gICAgdXNlck5hbWU6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXNzd29yZCBmcm9tIHlvdXIgd2luZG93cyBhY2NvdW50LlxuICAgICAqL1xuICAgIHBhc3N3b3JkOiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogT25jZSB5b3Ugc2V0IGRvbWFpbiBmb3IgbnRsbSBhdXRoZW50aWNhdGlvbiB0eXBlLCBkcml2ZXIgd2lsbCBjb25uZWN0IHRvIFNRTCBTZXJ2ZXIgdXNpbmcgZG9tYWluIGxvZ2luLlxuICAgICAqXG4gICAgICogVGhpcyBpcyBuZWNlc3NhcnkgZm9yIGZvcm1pbmcgYSBjb25uZWN0aW9uIHVzaW5nIG50bG0gdHlwZVxuICAgICAqL1xuICAgIGRvbWFpbjogc3RyaW5nO1xuICB9O1xufVxuXG5pbnRlcmZhY2UgRGVmYXVsdEF1dGhlbnRpY2F0aW9uIHtcbiAgdHlwZTogJ2RlZmF1bHQnO1xuICBvcHRpb25zOiB7XG4gICAgLyoqXG4gICAgICogVXNlciBuYW1lIHRvIHVzZSBmb3Igc3FsIHNlcnZlciBsb2dpbi5cbiAgICAgKi9cbiAgICB1c2VyTmFtZT86IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAvKipcbiAgICAgKiBQYXNzd29yZCB0byB1c2UgZm9yIHNxbCBzZXJ2ZXIgbG9naW4uXG4gICAgICovXG4gICAgcGFzc3dvcmQ/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIH07XG59XG5cbmludGVyZmFjZSBFcnJvcldpdGhDb2RlIGV4dGVuZHMgRXJyb3Ige1xuICBjb2RlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBDb25uZWN0aW9uQXV0aGVudGljYXRpb24gPSBEZWZhdWx0QXV0aGVudGljYXRpb24gfCBOdGxtQXV0aGVudGljYXRpb24gfCBUb2tlbkNyZWRlbnRpYWxBdXRoZW50aWNhdGlvbiB8IEF6dXJlQWN0aXZlRGlyZWN0b3J5UGFzc3dvcmRBdXRoZW50aWNhdGlvbiB8IEF6dXJlQWN0aXZlRGlyZWN0b3J5TXNpQXBwU2VydmljZUF1dGhlbnRpY2F0aW9uIHwgQXp1cmVBY3RpdmVEaXJlY3RvcnlNc2lWbUF1dGhlbnRpY2F0aW9uIHwgQXp1cmVBY3RpdmVEaXJlY3RvcnlBY2Nlc3NUb2tlbkF1dGhlbnRpY2F0aW9uIHwgQXp1cmVBY3RpdmVEaXJlY3RvcnlTZXJ2aWNlUHJpbmNpcGFsU2VjcmV0IHwgQXp1cmVBY3RpdmVEaXJlY3RvcnlEZWZhdWx0QXV0aGVudGljYXRpb247XG5cbmludGVyZmFjZSBJbnRlcm5hbENvbm5lY3Rpb25Db25maWcge1xuICBzZXJ2ZXI6IHN0cmluZztcbiAgYXV0aGVudGljYXRpb246IENvbm5lY3Rpb25BdXRoZW50aWNhdGlvbjtcbiAgb3B0aW9uczogSW50ZXJuYWxDb25uZWN0aW9uT3B0aW9ucztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJbnRlcm5hbENvbm5lY3Rpb25PcHRpb25zIHtcbiAgYWJvcnRUcmFuc2FjdGlvbk9uRXJyb3I6IGJvb2xlYW47XG4gIGFwcE5hbWU6IHVuZGVmaW5lZCB8IHN0cmluZztcbiAgY2FtZWxDYXNlQ29sdW1uczogYm9vbGVhbjtcbiAgY2FuY2VsVGltZW91dDogbnVtYmVyO1xuICBjb2x1bW5FbmNyeXB0aW9uS2V5Q2FjaGVUVEw6IG51bWJlcjtcbiAgY29sdW1uRW5jcnlwdGlvblNldHRpbmc6IGJvb2xlYW47XG4gIGNvbHVtbk5hbWVSZXBsYWNlcjogdW5kZWZpbmVkIHwgKChjb2xOYW1lOiBzdHJpbmcsIGluZGV4OiBudW1iZXIsIG1ldGFkYXRhOiBNZXRhZGF0YSkgPT4gc3RyaW5nKTtcbiAgY29ubmVjdGlvblJldHJ5SW50ZXJ2YWw6IG51bWJlcjtcbiAgY29ubmVjdG9yOiB1bmRlZmluZWQgfCAoKCkgPT4gUHJvbWlzZTxuZXQuU29ja2V0Pik7XG4gIGNvbm5lY3RUaW1lb3V0OiBudW1iZXI7XG4gIGNvbm5lY3Rpb25Jc29sYXRpb25MZXZlbDogdHlwZW9mIElTT0xBVElPTl9MRVZFTFtrZXlvZiB0eXBlb2YgSVNPTEFUSU9OX0xFVkVMXTtcbiAgY3J5cHRvQ3JlZGVudGlhbHNEZXRhaWxzOiBTZWN1cmVDb250ZXh0T3B0aW9ucztcbiAgZGF0YWJhc2U6IHVuZGVmaW5lZCB8IHN0cmluZztcbiAgZGF0ZWZpcnN0OiBudW1iZXI7XG4gIGRhdGVGb3JtYXQ6IHN0cmluZztcbiAgZGVidWc6IHtcbiAgICBkYXRhOiBib29sZWFuO1xuICAgIHBhY2tldDogYm9vbGVhbjtcbiAgICBwYXlsb2FkOiBib29sZWFuO1xuICAgIHRva2VuOiBib29sZWFuO1xuICB9O1xuICBlbmFibGVBbnNpTnVsbDogbnVsbCB8IGJvb2xlYW47XG4gIGVuYWJsZUFuc2lOdWxsRGVmYXVsdDogbnVsbCB8IGJvb2xlYW47XG4gIGVuYWJsZUFuc2lQYWRkaW5nOiBudWxsIHwgYm9vbGVhbjtcbiAgZW5hYmxlQW5zaVdhcm5pbmdzOiBudWxsIHwgYm9vbGVhbjtcbiAgZW5hYmxlQXJpdGhBYm9ydDogbnVsbCB8IGJvb2xlYW47XG4gIGVuYWJsZUNvbmNhdE51bGxZaWVsZHNOdWxsOiBudWxsIHwgYm9vbGVhbjtcbiAgZW5hYmxlQ3Vyc29yQ2xvc2VPbkNvbW1pdDogbnVsbCB8IGJvb2xlYW47XG4gIGVuYWJsZUltcGxpY2l0VHJhbnNhY3Rpb25zOiBudWxsIHwgYm9vbGVhbjtcbiAgZW5hYmxlTnVtZXJpY1JvdW5kYWJvcnQ6IG51bGwgfCBib29sZWFuO1xuICBlbmFibGVRdW90ZWRJZGVudGlmaWVyOiBudWxsIHwgYm9vbGVhbjtcbiAgZW5jcnlwdDogc3RyaW5nIHwgYm9vbGVhbjtcbiAgZW5jcnlwdGlvbktleVN0b3JlUHJvdmlkZXJzOiBLZXlTdG9yZVByb3ZpZGVyTWFwIHwgdW5kZWZpbmVkO1xuICBmYWxsYmFja1RvRGVmYXVsdERiOiBib29sZWFuO1xuICBpbnN0YW5jZU5hbWU6IHVuZGVmaW5lZCB8IHN0cmluZztcbiAgaXNvbGF0aW9uTGV2ZWw6IHR5cGVvZiBJU09MQVRJT05fTEVWRUxba2V5b2YgdHlwZW9mIElTT0xBVElPTl9MRVZFTF07XG4gIGxhbmd1YWdlOiBzdHJpbmc7XG4gIGxvY2FsQWRkcmVzczogdW5kZWZpbmVkIHwgc3RyaW5nO1xuICBtYXhSZXRyaWVzT25UcmFuc2llbnRFcnJvcnM6IG51bWJlcjtcbiAgbXVsdGlTdWJuZXRGYWlsb3ZlcjogYm9vbGVhbjtcbiAgcGFja2V0U2l6ZTogbnVtYmVyO1xuICBwb3J0OiB1bmRlZmluZWQgfCBudW1iZXI7XG4gIHJlYWRPbmx5SW50ZW50OiBib29sZWFuO1xuICByZXF1ZXN0VGltZW91dDogbnVtYmVyO1xuICByb3dDb2xsZWN0aW9uT25Eb25lOiBib29sZWFuO1xuICByb3dDb2xsZWN0aW9uT25SZXF1ZXN0Q29tcGxldGlvbjogYm9vbGVhbjtcbiAgc2VydmVyTmFtZTogdW5kZWZpbmVkIHwgc3RyaW5nO1xuICBzZXJ2ZXJTdXBwb3J0c0NvbHVtbkVuY3J5cHRpb246IGJvb2xlYW47XG4gIHRkc1ZlcnNpb246IHN0cmluZztcbiAgdGV4dHNpemU6IG51bWJlcjtcbiAgdHJ1c3RlZFNlcnZlck5hbWVBRTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICB0cnVzdFNlcnZlckNlcnRpZmljYXRlOiBib29sZWFuO1xuICB1c2VDb2x1bW5OYW1lczogYm9vbGVhbjtcbiAgdXNlVVRDOiBib29sZWFuO1xuICB3b3Jrc3RhdGlvbklkOiB1bmRlZmluZWQgfCBzdHJpbmc7XG4gIGxvd2VyQ2FzZUd1aWRzOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgS2V5U3RvcmVQcm92aWRlck1hcCB7XG4gIFtrZXk6IHN0cmluZ106IENvbHVtbkVuY3J5cHRpb25BenVyZUtleVZhdWx0UHJvdmlkZXI7XG59XG5cbi8qKlxuICogQHByaXZhdGVcbiAqL1xuaW50ZXJmYWNlIFN0YXRlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBlbnRlcj8odGhpczogQ29ubmVjdGlvbik6IHZvaWQ7XG4gIGV4aXQ/KHRoaXM6IENvbm5lY3Rpb24sIG5ld1N0YXRlOiBTdGF0ZSk6IHZvaWQ7XG4gIGV2ZW50czoge1xuICAgIHNvY2tldEVycm9yPyh0aGlzOiBDb25uZWN0aW9uLCBlcnI6IEVycm9yKTogdm9pZDtcbiAgICBjb25uZWN0VGltZW91dD8odGhpczogQ29ubmVjdGlvbik6IHZvaWQ7XG4gICAgbWVzc2FnZT8odGhpczogQ29ubmVjdGlvbiwgbWVzc2FnZTogTWVzc2FnZSk6IHZvaWQ7XG4gICAgcmV0cnk/KHRoaXM6IENvbm5lY3Rpb24pOiB2b2lkO1xuICAgIHJlY29ubmVjdD8odGhpczogQ29ubmVjdGlvbik6IHZvaWQ7XG4gIH07XG59XG5cbnR5cGUgQXV0aGVudGljYXRpb24gPSBEZWZhdWx0QXV0aGVudGljYXRpb24gfFxuICBOdGxtQXV0aGVudGljYXRpb24gfFxuICBUb2tlbkNyZWRlbnRpYWxBdXRoZW50aWNhdGlvbiB8XG4gIEF6dXJlQWN0aXZlRGlyZWN0b3J5UGFzc3dvcmRBdXRoZW50aWNhdGlvbiB8XG4gIEF6dXJlQWN0aXZlRGlyZWN0b3J5TXNpQXBwU2VydmljZUF1dGhlbnRpY2F0aW9uIHxcbiAgQXp1cmVBY3RpdmVEaXJlY3RvcnlNc2lWbUF1dGhlbnRpY2F0aW9uIHxcbiAgQXp1cmVBY3RpdmVEaXJlY3RvcnlBY2Nlc3NUb2tlbkF1dGhlbnRpY2F0aW9uIHxcbiAgQXp1cmVBY3RpdmVEaXJlY3RvcnlTZXJ2aWNlUHJpbmNpcGFsU2VjcmV0IHxcbiAgQXp1cmVBY3RpdmVEaXJlY3RvcnlEZWZhdWx0QXV0aGVudGljYXRpb247XG5cbnR5cGUgQXV0aGVudGljYXRpb25UeXBlID0gQXV0aGVudGljYXRpb25bJ3R5cGUnXTtcblxuZXhwb3J0IGludGVyZmFjZSBDb25uZWN0aW9uQ29uZmlndXJhdGlvbiB7XG4gIC8qKlxuICAgKiBIb3N0bmFtZSB0byBjb25uZWN0IHRvLlxuICAgKi9cbiAgc2VydmVyOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIGZvcm1pbmcgdGhlIGNvbm5lY3Rpb24uXG4gICAqL1xuICBvcHRpb25zPzogQ29ubmVjdGlvbk9wdGlvbnM7XG4gIC8qKlxuICAgKiBBdXRoZW50aWNhdGlvbiByZWxhdGVkIG9wdGlvbnMgZm9yIGNvbm5lY3Rpb24uXG4gICAqL1xuICBhdXRoZW50aWNhdGlvbj86IEF1dGhlbnRpY2F0aW9uT3B0aW9ucztcbn1cblxuaW50ZXJmYWNlIERlYnVnT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIGNvbnRyb2xsaW5nIHdoZXRoZXIgW1tkZWJ1Z11dIGV2ZW50cyB3aWxsIGJlIGVtaXR0ZWQgd2l0aCB0ZXh0IGRlc2NyaWJpbmcgcGFja2V0IGRhdGEgZGV0YWlsc1xuICAgKlxuICAgKiAoZGVmYXVsdDogYGZhbHNlYClcbiAgICovXG4gIGRhdGE6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIGNvbnRyb2xsaW5nIHdoZXRoZXIgW1tkZWJ1Z11dIGV2ZW50cyB3aWxsIGJlIGVtaXR0ZWQgd2l0aCB0ZXh0IGRlc2NyaWJpbmcgcGFja2V0IGRldGFpbHNcbiAgICpcbiAgICogKGRlZmF1bHQ6IGBmYWxzZWApXG4gICAqL1xuICBwYWNrZXQ6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIGNvbnRyb2xsaW5nIHdoZXRoZXIgW1tkZWJ1Z11dIGV2ZW50cyB3aWxsIGJlIGVtaXR0ZWQgd2l0aCB0ZXh0IGRlc2NyaWJpbmcgcGFja2V0IHBheWxvYWQgZGV0YWlsc1xuICAgKlxuICAgKiAoZGVmYXVsdDogYGZhbHNlYClcbiAgICovXG4gIHBheWxvYWQ6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIGNvbnRyb2xsaW5nIHdoZXRoZXIgW1tkZWJ1Z11dIGV2ZW50cyB3aWxsIGJlIGVtaXR0ZWQgd2l0aCB0ZXh0IGRlc2NyaWJpbmcgdG9rZW4gc3RyZWFtIHRva2Vuc1xuICAgKlxuICAgKiAoZGVmYXVsdDogYGZhbHNlYClcbiAgICovXG4gIHRva2VuOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgQXV0aGVudGljYXRpb25PcHRpb25zIHtcbiAgLyoqXG4gICAqIFR5cGUgb2YgdGhlIGF1dGhlbnRpY2F0aW9uIG1ldGhvZCwgdmFsaWQgdHlwZXMgYXJlIGBkZWZhdWx0YCwgYG50bG1gLFxuICAgKiBgYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1wYXNzd29yZGAsIGBhenVyZS1hY3RpdmUtZGlyZWN0b3J5LWFjY2Vzcy10b2tlbmAsXG4gICAqIGBhenVyZS1hY3RpdmUtZGlyZWN0b3J5LW1zaS12bWAsIGBhenVyZS1hY3RpdmUtZGlyZWN0b3J5LW1zaS1hcHAtc2VydmljZWAsXG4gICAqIGBhenVyZS1hY3RpdmUtZGlyZWN0b3J5LWRlZmF1bHRgXG4gICAqIG9yIGBhenVyZS1hY3RpdmUtZGlyZWN0b3J5LXNlcnZpY2UtcHJpbmNpcGFsLXNlY3JldGBcbiAgICovXG4gIHR5cGU/OiBBdXRoZW50aWNhdGlvblR5cGU7XG4gIC8qKlxuICAgKiBEaWZmZXJlbnQgb3B0aW9ucyBmb3IgYXV0aGVudGljYXRpb24gdHlwZXM6XG4gICAqXG4gICAqICogYGRlZmF1bHRgOiBbW0RlZmF1bHRBdXRoZW50aWNhdGlvbi5vcHRpb25zXV1cbiAgICogKiBgbnRsbWAgOltbTnRsbUF1dGhlbnRpY2F0aW9uXV1cbiAgICogKiBgdG9rZW4tY3JlZGVudGlhbGA6IFtbQ3JlZGVudGlhbENoYWluQXV0aGVudGljYXRpb24ub3B0aW9uc11dXG4gICAqICogYGF6dXJlLWFjdGl2ZS1kaXJlY3RvcnktcGFzc3dvcmRgIDogW1tBenVyZUFjdGl2ZURpcmVjdG9yeVBhc3N3b3JkQXV0aGVudGljYXRpb24ub3B0aW9uc11dXG4gICAqICogYGF6dXJlLWFjdGl2ZS1kaXJlY3RvcnktYWNjZXNzLXRva2VuYCA6IFtbQXp1cmVBY3RpdmVEaXJlY3RvcnlBY2Nlc3NUb2tlbkF1dGhlbnRpY2F0aW9uLm9wdGlvbnNdXVxuICAgKiAqIGBhenVyZS1hY3RpdmUtZGlyZWN0b3J5LW1zaS12bWAgOiBbW0F6dXJlQWN0aXZlRGlyZWN0b3J5TXNpVm1BdXRoZW50aWNhdGlvbi5vcHRpb25zXV1cbiAgICogKiBgYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1tc2ktYXBwLXNlcnZpY2VgIDogW1tBenVyZUFjdGl2ZURpcmVjdG9yeU1zaUFwcFNlcnZpY2VBdXRoZW50aWNhdGlvbi5vcHRpb25zXV1cbiAgICogKiBgYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1zZXJ2aWNlLXByaW5jaXBhbC1zZWNyZXRgIDogW1tBenVyZUFjdGl2ZURpcmVjdG9yeVNlcnZpY2VQcmluY2lwYWxTZWNyZXQub3B0aW9uc11dXG4gICAqICogYGF6dXJlLWFjdGl2ZS1kaXJlY3RvcnktZGVmYXVsdGAgOiBbW0F6dXJlQWN0aXZlRGlyZWN0b3J5RGVmYXVsdEF1dGhlbnRpY2F0aW9uLm9wdGlvbnNdXVxuICAgKi9cbiAgb3B0aW9ucz86IGFueTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb25uZWN0aW9uT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBBIGJvb2xlYW4gZGV0ZXJtaW5pbmcgd2hldGhlciB0byByb2xsYmFjayBhIHRyYW5zYWN0aW9uIGF1dG9tYXRpY2FsbHkgaWYgYW55IGVycm9yIGlzIGVuY291bnRlcmVkXG4gICAqIGR1cmluZyB0aGUgZ2l2ZW4gdHJhbnNhY3Rpb24ncyBleGVjdXRpb24uIFRoaXMgc2V0cyB0aGUgdmFsdWUgZm9yIGBTRVQgWEFDVF9BQk9SVGAgZHVyaW5nIHRoZVxuICAgKiBpbml0aWFsIFNRTCBwaGFzZSBvZiBhIGNvbm5lY3Rpb24gW2RvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5taWNyb3NvZnQuY29tL2VuLXVzL3NxbC90LXNxbC9zdGF0ZW1lbnRzL3NldC14YWN0LWFib3J0LXRyYW5zYWN0LXNxbCkuXG4gICAqL1xuICBhYm9ydFRyYW5zYWN0aW9uT25FcnJvcj86IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIEFwcGxpY2F0aW9uIG5hbWUgdXNlZCBmb3IgaWRlbnRpZnlpbmcgYSBzcGVjaWZpYyBhcHBsaWNhdGlvbiBpbiBwcm9maWxpbmcsIGxvZ2dpbmcgb3IgdHJhY2luZyB0b29scyBvZiBTUUxTZXJ2ZXIuXG4gICAqXG4gICAqIChkZWZhdWx0OiBgVGVkaW91c2ApXG4gICAqL1xuICBhcHBOYW1lPzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIGNvbnRyb2xsaW5nIHdoZXRoZXIgdGhlIGNvbHVtbiBuYW1lcyByZXR1cm5lZCB3aWxsIGhhdmUgdGhlIGZpcnN0IGxldHRlciBjb252ZXJ0ZWQgdG8gbG93ZXIgY2FzZVxuICAgKiAoYHRydWVgKSBvciBub3QuIFRoaXMgdmFsdWUgaXMgaWdub3JlZCBpZiB5b3UgcHJvdmlkZSBhIFtbY29sdW1uTmFtZVJlcGxhY2VyXV0uXG4gICAqXG4gICAqIChkZWZhdWx0OiBgZmFsc2VgKS5cbiAgICovXG4gIGNhbWVsQ2FzZUNvbHVtbnM/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBiZWZvcmUgdGhlIFtbUmVxdWVzdC5jYW5jZWxdXSAoYWJvcnQpIG9mIGEgcmVxdWVzdCBpcyBjb25zaWRlcmVkIGZhaWxlZFxuICAgKlxuICAgKiAoZGVmYXVsdDogYDUwMDBgKS5cbiAgICovXG4gIGNhbmNlbFRpbWVvdXQ/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEEgZnVuY3Rpb24gd2l0aCBwYXJhbWV0ZXJzIGAoY29sdW1uTmFtZSwgaW5kZXgsIGNvbHVtbk1ldGFEYXRhKWAgYW5kIHJldHVybmluZyBhIHN0cmluZy4gSWYgcHJvdmlkZWQsXG4gICAqIHRoaXMgd2lsbCBiZSBjYWxsZWQgb25jZSBwZXIgY29sdW1uIHBlciByZXN1bHQtc2V0LiBUaGUgcmV0dXJuZWQgdmFsdWUgd2lsbCBiZSB1c2VkIGluc3RlYWQgb2YgdGhlIFNRTC1wcm92aWRlZFxuICAgKiBjb2x1bW4gbmFtZSBvbiByb3cgYW5kIG1ldGEgZGF0YSBvYmplY3RzLiBUaGlzIGFsbG93cyB5b3UgdG8gZHluYW1pY2FsbHkgY29udmVydCBiZXR3ZWVuIG5hbWluZyBjb252ZW50aW9ucy5cbiAgICpcbiAgICogKGRlZmF1bHQ6IGBudWxsYClcbiAgICovXG4gIGNvbHVtbk5hbWVSZXBsYWNlcj86IChjb2xOYW1lOiBzdHJpbmcsIGluZGV4OiBudW1iZXIsIG1ldGFkYXRhOiBNZXRhZGF0YSkgPT4gc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBOdW1iZXIgb2YgbWlsbGlzZWNvbmRzIGJlZm9yZSByZXRyeWluZyB0byBlc3RhYmxpc2ggY29ubmVjdGlvbiwgaW4gY2FzZSBvZiB0cmFuc2llbnQgZmFpbHVyZS5cbiAgICpcbiAgICogKGRlZmF1bHQ6YDUwMGApXG4gICAqL1xuICBjb25uZWN0aW9uUmV0cnlJbnRlcnZhbD86IG51bWJlcjtcblxuICAvKipcbiAgICogQ3VzdG9tIGNvbm5lY3RvciBmYWN0b3J5IG1ldGhvZC5cbiAgICpcbiAgICogKGRlZmF1bHQ6IGB1bmRlZmluZWRgKVxuICAgKi9cbiAgY29ubmVjdG9yPzogKCkgPT4gUHJvbWlzZTxuZXQuU29ja2V0PjtcblxuICAvKipcbiAgICogVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgYmVmb3JlIHRoZSBhdHRlbXB0IHRvIGNvbm5lY3QgaXMgY29uc2lkZXJlZCBmYWlsZWRcbiAgICpcbiAgICogKGRlZmF1bHQ6IGAxNTAwMGApLlxuICAgKi9cbiAgY29ubmVjdFRpbWVvdXQ/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFRoZSBkZWZhdWx0IGlzb2xhdGlvbiBsZXZlbCBmb3IgbmV3IGNvbm5lY3Rpb25zLiBBbGwgb3V0LW9mLXRyYW5zYWN0aW9uIHF1ZXJpZXMgYXJlIGV4ZWN1dGVkIHdpdGggdGhpcyBzZXR0aW5nLlxuICAgKlxuICAgKiBUaGUgaXNvbGF0aW9uIGxldmVscyBhcmUgYXZhaWxhYmxlIGZyb20gYHJlcXVpcmUoJ3RlZGlvdXMnKS5JU09MQVRJT05fTEVWRUxgLlxuICAgKiAqIGBSRUFEX1VOQ09NTUlUVEVEYFxuICAgKiAqIGBSRUFEX0NPTU1JVFRFRGBcbiAgICogKiBgUkVQRUFUQUJMRV9SRUFEYFxuICAgKiAqIGBTRVJJQUxJWkFCTEVgXG4gICAqICogYFNOQVBTSE9UYFxuICAgKlxuICAgKiAoZGVmYXVsdDogYFJFQURfQ09NTUlURURgKS5cbiAgICovXG4gIGNvbm5lY3Rpb25Jc29sYXRpb25MZXZlbD86IG51bWJlcjtcblxuICAvKipcbiAgICogV2hlbiBlbmNyeXB0aW9uIGlzIHVzZWQsIGFuIG9iamVjdCBtYXkgYmUgc3VwcGxpZWQgdGhhdCB3aWxsIGJlIHVzZWRcbiAgICogZm9yIHRoZSBmaXJzdCBhcmd1bWVudCB3aGVuIGNhbGxpbmcgW2B0bHMuY3JlYXRlU2VjdXJlUGFpcmBdKGh0dHA6Ly9ub2RlanMub3JnL2RvY3MvbGF0ZXN0L2FwaS90bHMuaHRtbCN0bHNfdGxzX2NyZWF0ZXNlY3VyZXBhaXJfY3JlZGVudGlhbHNfaXNzZXJ2ZXJfcmVxdWVzdGNlcnRfcmVqZWN0dW5hdXRob3JpemVkKVxuICAgKlxuICAgKiAoZGVmYXVsdDogYHt9YClcbiAgICovXG4gIGNyeXB0b0NyZWRlbnRpYWxzRGV0YWlscz86IFNlY3VyZUNvbnRleHRPcHRpb25zO1xuXG4gIC8qKlxuICAgKiBEYXRhYmFzZSB0byBjb25uZWN0IHRvIChkZWZhdWx0OiBkZXBlbmRlbnQgb24gc2VydmVyIGNvbmZpZ3VyYXRpb24pLlxuICAgKi9cbiAgZGF0YWJhc2U/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGZpcnN0IGRheSBvZiB0aGUgd2VlayB0byBhIG51bWJlciBmcm9tIDEgdGhyb3VnaCA3LlxuICAgKi9cbiAgZGF0ZWZpcnN0PzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBBIHN0cmluZyByZXByZXNlbnRpbmcgcG9zaXRpb24gb2YgbW9udGgsIGRheSBhbmQgeWVhciBpbiB0ZW1wb3JhbCBkYXRhdHlwZXMuXG4gICAqXG4gICAqIChkZWZhdWx0OiBgbWR5YClcbiAgICovXG4gIGRhdGVGb3JtYXQ/OiBzdHJpbmc7XG5cbiAgZGVidWc/OiBEZWJ1Z09wdGlvbnM7XG5cbiAgLyoqXG4gICAqIEEgYm9vbGVhbiwgY29udHJvbHMgdGhlIHdheSBudWxsIHZhbHVlcyBzaG91bGQgYmUgdXNlZCBkdXJpbmcgY29tcGFyaXNvbiBvcGVyYXRpb24uXG4gICAqXG4gICAqIChkZWZhdWx0OiBgdHJ1ZWApXG4gICAqL1xuICBlbmFibGVBbnNpTnVsbD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIElmIHRydWUsIGBTRVQgQU5TSV9OVUxMX0RGTFRfT04gT05gIHdpbGwgYmUgc2V0IGluIHRoZSBpbml0aWFsIHNxbC4gVGhpcyBtZWFucyBuZXcgY29sdW1ucyB3aWxsIGJlXG4gICAqIG51bGxhYmxlIGJ5IGRlZmF1bHQuIFNlZSB0aGUgW1QtU1FMIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvbXMxODczNzUuYXNweClcbiAgICpcbiAgICogKGRlZmF1bHQ6IGB0cnVlYCkuXG4gICAqL1xuICBlbmFibGVBbnNpTnVsbERlZmF1bHQ/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIGNvbnRyb2xzIGlmIHBhZGRpbmcgc2hvdWxkIGJlIGFwcGxpZWQgZm9yIHZhbHVlcyBzaG9ydGVyIHRoYW4gdGhlIHNpemUgb2YgZGVmaW5lZCBjb2x1bW4uXG4gICAqXG4gICAqIChkZWZhdWx0OiBgdHJ1ZWApXG4gICAqL1xuICBlbmFibGVBbnNpUGFkZGluZz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIElmIHRydWUsIFNRTCBTZXJ2ZXIgd2lsbCBmb2xsb3cgSVNPIHN0YW5kYXJkIGJlaGF2aW9yIGR1cmluZyB2YXJpb3VzIGVycm9yIGNvbmRpdGlvbnMuIEZvciBkZXRhaWxzLFxuICAgKiBzZWUgW2RvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5taWNyb3NvZnQuY29tL2VuLXVzL3NxbC90LXNxbC9zdGF0ZW1lbnRzL3NldC1hbnNpLXdhcm5pbmdzLXRyYW5zYWN0LXNxbClcbiAgICpcbiAgICogKGRlZmF1bHQ6IGB0cnVlYClcbiAgICovXG4gIGVuYWJsZUFuc2lXYXJuaW5ncz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEVuZHMgYSBxdWVyeSB3aGVuIGFuIG92ZXJmbG93IG9yIGRpdmlkZS1ieS16ZXJvIGVycm9yIG9jY3VycyBkdXJpbmcgcXVlcnkgZXhlY3V0aW9uLlxuICAgKiBTZWUgW2RvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5taWNyb3NvZnQuY29tL2VuLXVzL3NxbC90LXNxbC9zdGF0ZW1lbnRzL3NldC1hcml0aGFib3J0LXRyYW5zYWN0LXNxbD92aWV3PXNxbC1zZXJ2ZXItMjAxNylcbiAgICogZm9yIG1vcmUgZGV0YWlscy5cbiAgICpcbiAgICogKGRlZmF1bHQ6IGB0cnVlYClcbiAgICovXG4gIGVuYWJsZUFyaXRoQWJvcnQ/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIGRldGVybWluZXMgaWYgY29uY2F0ZW5hdGlvbiB3aXRoIE5VTEwgc2hvdWxkIHJlc3VsdCBpbiBOVUxMIG9yIGVtcHR5IHN0cmluZyB2YWx1ZSwgbW9yZSBkZXRhaWxzIGluXG4gICAqIFtkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubWljcm9zb2Z0LmNvbS9lbi11cy9zcWwvdC1zcWwvc3RhdGVtZW50cy9zZXQtY29uY2F0LW51bGwteWllbGRzLW51bGwtdHJhbnNhY3Qtc3FsKVxuICAgKlxuICAgKiAoZGVmYXVsdDogYHRydWVgKVxuICAgKi9cbiAgZW5hYmxlQ29uY2F0TnVsbFlpZWxkc051bGw/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIGNvbnRyb2xzIHdoZXRoZXIgY3Vyc29yIHNob3VsZCBiZSBjbG9zZWQsIGlmIHRoZSB0cmFuc2FjdGlvbiBvcGVuaW5nIGl0IGdldHMgY29tbWl0dGVkIG9yIHJvbGxlZFxuICAgKiBiYWNrLlxuICAgKlxuICAgKiAoZGVmYXVsdDogYG51bGxgKVxuICAgKi9cbiAgZW5hYmxlQ3Vyc29yQ2xvc2VPbkNvbW1pdD86IGJvb2xlYW4gfCBudWxsO1xuXG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIHNldHMgdGhlIGNvbm5lY3Rpb24gdG8gZWl0aGVyIGltcGxpY2l0IG9yIGF1dG9jb21taXQgdHJhbnNhY3Rpb24gbW9kZS5cbiAgICpcbiAgICogKGRlZmF1bHQ6IGBmYWxzZWApXG4gICAqL1xuICBlbmFibGVJbXBsaWNpdFRyYW5zYWN0aW9ucz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIElmIGZhbHNlLCBlcnJvciBpcyBub3QgZ2VuZXJhdGVkIGR1cmluZyBsb3NzIG9mIHByZWNlc3Npb24uXG4gICAqXG4gICAqIChkZWZhdWx0OiBgZmFsc2VgKVxuICAgKi9cbiAgZW5hYmxlTnVtZXJpY1JvdW5kYWJvcnQ/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBJZiB0cnVlLCBjaGFyYWN0ZXJzIGVuY2xvc2VkIGluIHNpbmdsZSBxdW90ZXMgYXJlIHRyZWF0ZWQgYXMgbGl0ZXJhbHMgYW5kIHRob3NlIGVuY2xvc2VkIGRvdWJsZSBxdW90ZXMgYXJlIHRyZWF0ZWQgYXMgaWRlbnRpZmllcnMuXG4gICAqXG4gICAqIChkZWZhdWx0OiBgdHJ1ZWApXG4gICAqL1xuICBlbmFibGVRdW90ZWRJZGVudGlmaWVyPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQSBzdHJpbmcgdmFsdWUgdGhhdCBjYW4gYmUgb25seSBzZXQgdG8gJ3N0cmljdCcsIHdoaWNoIGluZGljYXRlcyB0aGUgdXNhZ2UgVERTIDguMCBwcm90b2NvbC4gT3RoZXJ3aXNlLFxuICAgKiBhIGJvb2xlYW4gZGV0ZXJtaW5pbmcgd2hldGhlciBvciBub3QgdGhlIGNvbm5lY3Rpb24gd2lsbCBiZSBlbmNyeXB0ZWQuXG4gICAqXG4gICAqIChkZWZhdWx0OiBgdHJ1ZWApXG4gICAqL1xuICBlbmNyeXB0Pzogc3RyaW5nIHwgYm9vbGVhbjtcblxuICAvKipcbiAgICogQnkgZGVmYXVsdCwgaWYgdGhlIGRhdGFiYXNlIHJlcXVlc3RlZCBieSBbW2RhdGFiYXNlXV0gY2Fubm90IGJlIGFjY2Vzc2VkLFxuICAgKiB0aGUgY29ubmVjdGlvbiB3aWxsIGZhaWwgd2l0aCBhbiBlcnJvci4gSG93ZXZlciwgaWYgW1tmYWxsYmFja1RvRGVmYXVsdERiXV0gaXNcbiAgICogc2V0IHRvIGB0cnVlYCwgdGhlbiB0aGUgdXNlcidzIGRlZmF1bHQgZGF0YWJhc2Ugd2lsbCBiZSB1c2VkIGluc3RlYWRcbiAgICpcbiAgICogKGRlZmF1bHQ6IGBmYWxzZWApXG4gICAqL1xuICBmYWxsYmFja1RvRGVmYXVsdERiPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIGluc3RhbmNlIG5hbWUgdG8gY29ubmVjdCB0by5cbiAgICogVGhlIFNRTCBTZXJ2ZXIgQnJvd3NlciBzZXJ2aWNlIG11c3QgYmUgcnVubmluZyBvbiB0aGUgZGF0YWJhc2Ugc2VydmVyLFxuICAgKiBhbmQgVURQIHBvcnQgMTQzNCBvbiB0aGUgZGF0YWJhc2Ugc2VydmVyIG11c3QgYmUgcmVhY2hhYmxlLlxuICAgKlxuICAgKiAobm8gZGVmYXVsdClcbiAgICpcbiAgICogTXV0dWFsbHkgZXhjbHVzaXZlIHdpdGggW1twb3J0XV0uXG4gICAqL1xuICBpbnN0YW5jZU5hbWU/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIFRoZSBkZWZhdWx0IGlzb2xhdGlvbiBsZXZlbCB0aGF0IHRyYW5zYWN0aW9ucyB3aWxsIGJlIHJ1biB3aXRoLlxuICAgKlxuICAgKiBUaGUgaXNvbGF0aW9uIGxldmVscyBhcmUgYXZhaWxhYmxlIGZyb20gYHJlcXVpcmUoJ3RlZGlvdXMnKS5JU09MQVRJT05fTEVWRUxgLlxuICAgKiAqIGBSRUFEX1VOQ09NTUlUVEVEYFxuICAgKiAqIGBSRUFEX0NPTU1JVFRFRGBcbiAgICogKiBgUkVQRUFUQUJMRV9SRUFEYFxuICAgKiAqIGBTRVJJQUxJWkFCTEVgXG4gICAqICogYFNOQVBTSE9UYFxuICAgKlxuICAgKiAoZGVmYXVsdDogYFJFQURfQ09NTUlURURgKS5cbiAgICovXG4gIGlzb2xhdGlvbkxldmVsPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBTcGVjaWZpZXMgdGhlIGxhbmd1YWdlIGVudmlyb25tZW50IGZvciB0aGUgc2Vzc2lvbi4gVGhlIHNlc3Npb24gbGFuZ3VhZ2UgZGV0ZXJtaW5lcyB0aGUgZGF0ZXRpbWUgZm9ybWF0cyBhbmQgc3lzdGVtIG1lc3NhZ2VzLlxuICAgKlxuICAgKiAoZGVmYXVsdDogYHVzX2VuZ2xpc2hgKS5cbiAgICovXG4gIGxhbmd1YWdlPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBIHN0cmluZyBpbmRpY2F0aW5nIHdoaWNoIG5ldHdvcmsgaW50ZXJmYWNlIChpcCBhZGRyZXNzKSB0byB1c2Ugd2hlbiBjb25uZWN0aW5nIHRvIFNRTCBTZXJ2ZXIuXG4gICAqL1xuICBsb2NhbEFkZHJlc3M/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIEEgYm9vbGVhbiBkZXRlcm1pbmluZyB3aGV0aGVyIHRvIHBhcnNlIHVuaXF1ZSBpZGVudGlmaWVyIHR5cGUgd2l0aCBsb3dlcmNhc2UgY2FzZSBjaGFyYWN0ZXJzLlxuICAgKlxuICAgKiAoZGVmYXVsdDogYGZhbHNlYCkuXG4gICAqL1xuICBsb3dlckNhc2VHdWlkcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBjb25uZWN0aW9uIHJldHJpZXMgZm9yIHRyYW5zaWVudCBlcnJvcnMu44CBXG4gICAqXG4gICAqIChkZWZhdWx0OiBgM2ApLlxuICAgKi9cbiAgbWF4UmV0cmllc09uVHJhbnNpZW50RXJyb3JzPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBNdWx0aVN1Ym5ldEZhaWxvdmVyID0gVHJ1ZSBwYXJhbWV0ZXIsIHdoaWNoIGNhbiBoZWxwIG1pbmltaXplIHRoZSBjbGllbnQgcmVjb3ZlcnkgbGF0ZW5jeSB3aGVuIGZhaWxvdmVycyBvY2N1ci5cbiAgICpcbiAgICogKGRlZmF1bHQ6IGBmYWxzZWApLlxuICAgKi9cbiAgbXVsdGlTdWJuZXRGYWlsb3Zlcj86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRoZSBzaXplIG9mIFREUyBwYWNrZXRzIChzdWJqZWN0IHRvIG5lZ290aWF0aW9uIHdpdGggdGhlIHNlcnZlcikuXG4gICAqIFNob3VsZCBiZSBhIHBvd2VyIG9mIDIuXG4gICAqXG4gICAqIChkZWZhdWx0OiBgNDA5NmApLlxuICAgKi9cbiAgcGFja2V0U2l6ZT86IG51bWJlcjtcblxuICAvKipcbiAgICogUG9ydCB0byBjb25uZWN0IHRvIChkZWZhdWx0OiBgMTQzM2ApLlxuICAgKlxuICAgKiBNdXR1YWxseSBleGNsdXNpdmUgd2l0aCBbW2luc3RhbmNlTmFtZV1dXG4gICAqL1xuICBwb3J0PzogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIGRldGVybWluaW5nIHdoZXRoZXIgdGhlIGNvbm5lY3Rpb24gd2lsbCByZXF1ZXN0IHJlYWQgb25seSBhY2Nlc3MgZnJvbSBhIFNRTCBTZXJ2ZXIgQXZhaWxhYmlsaXR5XG4gICAqIEdyb3VwLiBGb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIFtoZXJlXShodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvaGg3MTAwNTQuYXNweCBcIk1pY3Jvc29mdDogQ29uZmlndXJlIFJlYWQtT25seSBSb3V0aW5nIGZvciBhbiBBdmFpbGFiaWxpdHkgR3JvdXAgKFNRTCBTZXJ2ZXIpXCIpXG4gICAqXG4gICAqIChkZWZhdWx0OiBgZmFsc2VgKS5cbiAgICovXG4gIHJlYWRPbmx5SW50ZW50PzogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgYmVmb3JlIGEgcmVxdWVzdCBpcyBjb25zaWRlcmVkIGZhaWxlZCwgb3IgYDBgIGZvciBubyB0aW1lb3V0LlxuICAgKlxuICAgKiBBcyBzb29uIGFzIGEgcmVzcG9uc2UgaXMgcmVjZWl2ZWQsIHRoZSB0aW1lb3V0IGlzIGNsZWFyZWQuIFRoaXMgbWVhbnMgdGhhdCBxdWVyaWVzIHRoYXQgaW1tZWRpYXRlbHkgcmV0dXJuIGEgcmVzcG9uc2UgaGF2ZSBhYmlsaXR5IHRvIHJ1biBsb25nZXIgdGhhbiB0aGlzIHRpbWVvdXQuXG4gICAqXG4gICAqIChkZWZhdWx0OiBgMTUwMDBgKS5cbiAgICovXG4gIHJlcXVlc3RUaW1lb3V0PzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBBIGJvb2xlYW4sIHRoYXQgd2hlbiB0cnVlIHdpbGwgZXhwb3NlIHJlY2VpdmVkIHJvd3MgaW4gUmVxdWVzdHMgZG9uZSByZWxhdGVkIGV2ZW50czpcbiAgICogKiBbW1JlcXVlc3QuRXZlbnRfZG9uZUluUHJvY11dXG4gICAqICogW1tSZXF1ZXN0LkV2ZW50X2RvbmVQcm9jXV1cbiAgICogKiBbW1JlcXVlc3QuRXZlbnRfZG9uZV1dXG4gICAqXG4gICAqIChkZWZhdWx0OiBgZmFsc2VgKVxuICAgKlxuICAgKiBDYXV0aW9uOiBJZiBtYW55IHJvdyBhcmUgcmVjZWl2ZWQsIGVuYWJsaW5nIHRoaXMgb3B0aW9uIGNvdWxkIHJlc3VsdCBpblxuICAgKiBleGNlc3NpdmUgbWVtb3J5IHVzYWdlLlxuICAgKi9cbiAgcm93Q29sbGVjdGlvbk9uRG9uZT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEEgYm9vbGVhbiwgdGhhdCB3aGVuIHRydWUgd2lsbCBleHBvc2UgcmVjZWl2ZWQgcm93cyBpbiBSZXF1ZXN0cycgY29tcGxldGlvbiBjYWxsYmFjay5TZWUgW1tSZXF1ZXN0LmNvbnN0cnVjdG9yXV0uXG4gICAqXG4gICAqIChkZWZhdWx0OiBgZmFsc2VgKVxuICAgKlxuICAgKiBDYXV0aW9uOiBJZiBtYW55IHJvdyBhcmUgcmVjZWl2ZWQsIGVuYWJsaW5nIHRoaXMgb3B0aW9uIGNvdWxkIHJlc3VsdCBpblxuICAgKiBleGNlc3NpdmUgbWVtb3J5IHVzYWdlLlxuICAgKi9cbiAgcm93Q29sbGVjdGlvbk9uUmVxdWVzdENvbXBsZXRpb24/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBUaGUgdmVyc2lvbiBvZiBURFMgdG8gdXNlLiBJZiBzZXJ2ZXIgZG9lc24ndCBzdXBwb3J0IHNwZWNpZmllZCB2ZXJzaW9uLCBuZWdvdGlhdGVkIHZlcnNpb24gaXMgdXNlZCBpbnN0ZWFkLlxuICAgKlxuICAgKiBUaGUgdmVyc2lvbnMgYXJlIGF2YWlsYWJsZSBmcm9tIGByZXF1aXJlKCd0ZWRpb3VzJykuVERTX1ZFUlNJT05gLlxuICAgKiAqIGA3XzFgXG4gICAqICogYDdfMmBcbiAgICogKiBgN18zX0FgXG4gICAqICogYDdfM19CYFxuICAgKiAqIGA3XzRgXG4gICAqXG4gICAqIChkZWZhdWx0OiBgN180YClcbiAgICovXG4gIHRkc1ZlcnNpb24/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIFNwZWNpZmllcyB0aGUgc2l6ZSBvZiB2YXJjaGFyKG1heCksIG52YXJjaGFyKG1heCksIHZhcmJpbmFyeShtYXgpLCB0ZXh0LCBudGV4dCwgYW5kIGltYWdlIGRhdGEgcmV0dXJuZWQgYnkgYSBTRUxFQ1Qgc3RhdGVtZW50LlxuICAgKlxuICAgKiAoZGVmYXVsdDogYDIxNDc0ODM2NDdgKVxuICAgKi9cbiAgdGV4dHNpemU/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIElmIFwidHJ1ZVwiLCB0aGUgU1FMIFNlcnZlciBTU0wgY2VydGlmaWNhdGUgaXMgYXV0b21hdGljYWxseSB0cnVzdGVkIHdoZW4gdGhlIGNvbW11bmljYXRpb24gbGF5ZXIgaXMgZW5jcnlwdGVkIHVzaW5nIFNTTC5cbiAgICpcbiAgICogSWYgXCJmYWxzZVwiLCB0aGUgU1FMIFNlcnZlciB2YWxpZGF0ZXMgdGhlIHNlcnZlciBTU0wgY2VydGlmaWNhdGUuIElmIHRoZSBzZXJ2ZXIgY2VydGlmaWNhdGUgdmFsaWRhdGlvbiBmYWlscyxcbiAgICogdGhlIGRyaXZlciByYWlzZXMgYW4gZXJyb3IgYW5kIHRlcm1pbmF0ZXMgdGhlIGNvbm5lY3Rpb24uIE1ha2Ugc3VyZSB0aGUgdmFsdWUgcGFzc2VkIHRvIHNlcnZlck5hbWUgZXhhY3RseVxuICAgKiBtYXRjaGVzIHRoZSBDb21tb24gTmFtZSAoQ04pIG9yIEROUyBuYW1lIGluIHRoZSBTdWJqZWN0IEFsdGVybmF0ZSBOYW1lIGluIHRoZSBzZXJ2ZXIgY2VydGlmaWNhdGUgZm9yIGFuIFNTTCBjb25uZWN0aW9uIHRvIHN1Y2NlZWQuXG4gICAqXG4gICAqIChkZWZhdWx0OiBgdHJ1ZWApXG4gICAqL1xuICB0cnVzdFNlcnZlckNlcnRpZmljYXRlPzogYm9vbGVhbjtcblxuICAvKipcbiAgICpcbiAgICovXG4gIHNlcnZlck5hbWU/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBBIGJvb2xlYW4gZGV0ZXJtaW5pbmcgd2hldGhlciB0byByZXR1cm4gcm93cyBhcyBhcnJheXMgb3Iga2V5LXZhbHVlIGNvbGxlY3Rpb25zLlxuICAgKlxuICAgKiAoZGVmYXVsdDogYGZhbHNlYCkuXG4gICAqL1xuICB1c2VDb2x1bW5OYW1lcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEEgYm9vbGVhbiBkZXRlcm1pbmluZyB3aGV0aGVyIHRvIHBhc3MgdGltZSB2YWx1ZXMgaW4gVVRDIG9yIGxvY2FsIHRpbWUuXG4gICAqXG4gICAqIChkZWZhdWx0OiBgdHJ1ZWApLlxuICAgKi9cbiAgdXNlVVRDPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIHdvcmtzdGF0aW9uIElEIChXU0lEKSBvZiB0aGUgY2xpZW50LCBkZWZhdWx0IG9zLmhvc3RuYW1lKCkuXG4gICAqIFVzZWQgZm9yIGlkZW50aWZ5aW5nIGEgc3BlY2lmaWMgY2xpZW50IGluIHByb2ZpbGluZywgbG9nZ2luZyBvclxuICAgKiB0cmFjaW5nIGNsaWVudCBhY3Rpdml0eSBpbiBTUUxTZXJ2ZXIuXG4gICAqXG4gICAqIFRoZSB2YWx1ZSBpcyByZXBvcnRlZCBieSB0aGUgVFNRTCBmdW5jdGlvbiBIT1NUX05BTUUoKS5cbiAgICovXG4gIHdvcmtzdGF0aW9uSWQ/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQHByaXZhdGVcbiAqL1xuY29uc3QgQ0xFQU5VUF9UWVBFID0ge1xuICBOT1JNQUw6IDAsXG4gIFJFRElSRUNUOiAxLFxuICBSRVRSWTogMlxufTtcblxuaW50ZXJmYWNlIFJvdXRpbmdEYXRhIHtcbiAgc2VydmVyOiBzdHJpbmc7XG4gIHBvcnQ6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBBIFtbQ29ubmVjdGlvbl1dIGluc3RhbmNlIHJlcHJlc2VudHMgYSBzaW5nbGUgY29ubmVjdGlvbiB0byBhIGRhdGFiYXNlIHNlcnZlci5cbiAqXG4gKiBgYGBqc1xuICogdmFyIENvbm5lY3Rpb24gPSByZXF1aXJlKCd0ZWRpb3VzJykuQ29ubmVjdGlvbjtcbiAqIHZhciBjb25maWcgPSB7XG4gKiAgXCJhdXRoZW50aWNhdGlvblwiOiB7XG4gKiAgICAuLi4sXG4gKiAgICBcIm9wdGlvbnNcIjogey4uLn1cbiAqICB9LFxuICogIFwib3B0aW9uc1wiOiB7Li4ufVxuICogfTtcbiAqIHZhciBjb25uZWN0aW9uID0gbmV3IENvbm5lY3Rpb24oY29uZmlnKTtcbiAqIGBgYFxuICpcbiAqIE9ubHkgb25lIHJlcXVlc3QgYXQgYSB0aW1lIG1heSBiZSBleGVjdXRlZCBvbiBhIGNvbm5lY3Rpb24uIE9uY2UgYSBbW1JlcXVlc3RdXVxuICogaGFzIGJlZW4gaW5pdGlhdGVkICh3aXRoIFtbQ29ubmVjdGlvbi5jYWxsUHJvY2VkdXJlXV0sIFtbQ29ubmVjdGlvbi5leGVjU3FsXV0sXG4gKiBvciBbW0Nvbm5lY3Rpb24uZXhlY1NxbEJhdGNoXV0pLCBhbm90aGVyIHNob3VsZCBub3QgYmUgaW5pdGlhdGVkIHVudGlsIHRoZVxuICogW1tSZXF1ZXN0XV0ncyBjb21wbGV0aW9uIGNhbGxiYWNrIGlzIGNhbGxlZC5cbiAqL1xuY2xhc3MgQ29ubmVjdGlvbiBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSBmZWRBdXRoUmVxdWlyZWQ6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSBjb25maWc6IEludGVybmFsQ29ubmVjdGlvbkNvbmZpZztcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIHNlY3VyZUNvbnRleHRPcHRpb25zOiBTZWN1cmVDb250ZXh0T3B0aW9ucztcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIGluVHJhbnNhY3Rpb246IGJvb2xlYW47XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSB0cmFuc2FjdGlvbkRlc2NyaXB0b3JzOiBCdWZmZXJbXTtcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIHRyYW5zYWN0aW9uRGVwdGg6IG51bWJlcjtcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIGlzU3FsQmF0Y2g6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSBjdXJUcmFuc2llbnRSZXRyeUNvdW50OiBudW1iZXI7XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSB0cmFuc2llbnRFcnJvckxvb2t1cDogVHJhbnNpZW50RXJyb3JMb29rdXA7XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSBjbG9zZWQ6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSBsb2dpbkVycm9yOiB1bmRlZmluZWQgfCBBZ2dyZWdhdGVFcnJvciB8IENvbm5lY3Rpb25FcnJvcjtcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIGRlYnVnOiBEZWJ1ZztcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIG50bG1wYWNrZXQ6IHVuZGVmaW5lZCB8IGFueTtcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIG50bG1wYWNrZXRCdWZmZXI6IHVuZGVmaW5lZCB8IEJ1ZmZlcjtcblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGRlY2xhcmUgU1RBVEU6IHtcbiAgICBJTklUSUFMSVpFRDogU3RhdGU7XG4gICAgQ09OTkVDVElORzogU3RhdGU7XG4gICAgU0VOVF9QUkVMT0dJTjogU3RhdGU7XG4gICAgUkVST1VUSU5HOiBTdGF0ZTtcbiAgICBUUkFOU0lFTlRfRkFJTFVSRV9SRVRSWTogU3RhdGU7XG4gICAgU0VOVF9UTFNTU0xORUdPVElBVElPTjogU3RhdGU7XG4gICAgU0VOVF9MT0dJTjdfV0lUSF9TVEFOREFSRF9MT0dJTjogU3RhdGU7XG4gICAgU0VOVF9MT0dJTjdfV0lUSF9OVExNOiBTdGF0ZTtcbiAgICBTRU5UX0xPR0lON19XSVRIX0ZFREFVVEg6IFN0YXRlO1xuICAgIExPR0dFRF9JTl9TRU5ESU5HX0lOSVRJQUxfU1FMOiBTdGF0ZTtcbiAgICBMT0dHRURfSU46IFN0YXRlO1xuICAgIFNFTlRfQ0xJRU5UX1JFUVVFU1Q6IFN0YXRlO1xuICAgIFNFTlRfQVRURU5USU9OOiBTdGF0ZTtcbiAgICBGSU5BTDogU3RhdGU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIHJvdXRpbmdEYXRhOiB1bmRlZmluZWQgfCBSb3V0aW5nRGF0YTtcblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGRlY2xhcmUgbWVzc2FnZUlvOiBNZXNzYWdlSU87XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSBzdGF0ZTogU3RhdGU7XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSByZXNldENvbm5lY3Rpb25Pbk5leHRSZXF1ZXN0OiB1bmRlZmluZWQgfCBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSByZXF1ZXN0OiB1bmRlZmluZWQgfCBSZXF1ZXN0IHwgQnVsa0xvYWQ7XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSBwcm9jUmV0dXJuU3RhdHVzVmFsdWU6IHVuZGVmaW5lZCB8IGFueTtcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIHNvY2tldDogdW5kZWZpbmVkIHwgbmV0LlNvY2tldDtcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIG1lc3NhZ2VCdWZmZXI6IEJ1ZmZlcjtcblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGRlY2xhcmUgY29ubmVjdFRpbWVyOiB1bmRlZmluZWQgfCBOb2RlSlMuVGltZW91dDtcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIGNhbmNlbFRpbWVyOiB1bmRlZmluZWQgfCBOb2RlSlMuVGltZW91dDtcbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBkZWNsYXJlIHJlcXVlc3RUaW1lcjogdW5kZWZpbmVkIHwgTm9kZUpTLlRpbWVvdXQ7XG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSByZXRyeVRpbWVyOiB1bmRlZmluZWQgfCBOb2RlSlMuVGltZW91dDtcblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9jYW5jZWxBZnRlclJlcXVlc3RTZW50OiAoKSA9PiB2b2lkO1xuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZGVjbGFyZSBkYXRhYmFzZUNvbGxhdGlvbjogQ29sbGF0aW9uIHwgdW5kZWZpbmVkO1xuXG4gIC8qKlxuICAgKiBOb3RlOiBiZSBhd2FyZSBvZiB0aGUgZGlmZmVyZW50IG9wdGlvbnMgZmllbGQ6XG4gICAqIDEuIGNvbmZpZy5hdXRoZW50aWNhdGlvbi5vcHRpb25zXG4gICAqIDIuIGNvbmZpZy5vcHRpb25zXG4gICAqXG4gICAqIGBgYGpzXG4gICAqIGNvbnN0IHsgQ29ubmVjdGlvbiB9ID0gcmVxdWlyZSgndGVkaW91cycpO1xuICAgKlxuICAgKiBjb25zdCBjb25maWcgPSB7XG4gICAqICBcImF1dGhlbnRpY2F0aW9uXCI6IHtcbiAgICogICAgLi4uLFxuICAgKiAgICBcIm9wdGlvbnNcIjogey4uLn1cbiAgICogIH0sXG4gICAqICBcIm9wdGlvbnNcIjogey4uLn1cbiAgICogfTtcbiAgICpcbiAgICogY29uc3QgY29ubmVjdGlvbiA9IG5ldyBDb25uZWN0aW9uKGNvbmZpZyk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gY29uZmlnXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihjb25maWc6IENvbm5lY3Rpb25Db25maWd1cmF0aW9uKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICh0eXBlb2YgY29uZmlnICE9PSAnb2JqZWN0JyB8fCBjb25maWcgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZ1wiIGFyZ3VtZW50IGlzIHJlcXVpcmVkIGFuZCBtdXN0IGJlIG9mIHR5cGUgT2JqZWN0LicpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgY29uZmlnLnNlcnZlciAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5zZXJ2ZXJcIiBwcm9wZXJ0eSBpcyByZXF1aXJlZCBhbmQgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4nKTtcbiAgICB9XG5cbiAgICB0aGlzLmZlZEF1dGhSZXF1aXJlZCA9IGZhbHNlO1xuXG4gICAgbGV0IGF1dGhlbnRpY2F0aW9uOiBDb25uZWN0aW9uQXV0aGVudGljYXRpb247XG4gICAgaWYgKGNvbmZpZy5hdXRoZW50aWNhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAodHlwZW9mIGNvbmZpZy5hdXRoZW50aWNhdGlvbiAhPT0gJ29iamVjdCcgfHwgY29uZmlnLmF1dGhlbnRpY2F0aW9uID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5hdXRoZW50aWNhdGlvblwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBPYmplY3QuJyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHR5cGUgPSBjb25maWcuYXV0aGVudGljYXRpb24udHlwZTtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSBjb25maWcuYXV0aGVudGljYXRpb24ub3B0aW9ucyA9PT0gdW5kZWZpbmVkID8ge30gOiBjb25maWcuYXV0aGVudGljYXRpb24ub3B0aW9ucztcblxuICAgICAgaWYgKHR5cGVvZiB0eXBlICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcuYXV0aGVudGljYXRpb24udHlwZVwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcuJyk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlICE9PSAnZGVmYXVsdCcgJiYgdHlwZSAhPT0gJ250bG0nICYmIHR5cGUgIT09ICd0b2tlbi1jcmVkZW50aWFsJyAmJiB0eXBlICE9PSAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1wYXNzd29yZCcgJiYgdHlwZSAhPT0gJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktYWNjZXNzLXRva2VuJyAmJiB0eXBlICE9PSAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1tc2ktdm0nICYmIHR5cGUgIT09ICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LW1zaS1hcHAtc2VydmljZScgJiYgdHlwZSAhPT0gJ2F6dXJlLWFjdGl2ZS1kaXJlY3Rvcnktc2VydmljZS1wcmluY2lwYWwtc2VjcmV0JyAmJiB0eXBlICE9PSAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1kZWZhdWx0Jykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJ0eXBlXCIgcHJvcGVydHkgbXVzdCBvbmUgb2YgXCJkZWZhdWx0XCIsIFwibnRsbVwiLCBcInRva2VuLWNyZWRlbnRpYWxcIiwgXCJhenVyZS1hY3RpdmUtZGlyZWN0b3J5LXBhc3N3b3JkXCIsIFwiYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1hY2Nlc3MtdG9rZW5cIiwgXCJhenVyZS1hY3RpdmUtZGlyZWN0b3J5LWRlZmF1bHRcIiwgXCJhenVyZS1hY3RpdmUtZGlyZWN0b3J5LW1zaS12bVwiIG9yIFwiYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1tc2ktYXBwLXNlcnZpY2VcIiBvciBcImF6dXJlLWFjdGl2ZS1kaXJlY3Rvcnktc2VydmljZS1wcmluY2lwYWwtc2VjcmV0XCIuJyk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcuYXV0aGVudGljYXRpb24ub3B0aW9uc1wiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBvYmplY3QuJyk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlID09PSAnbnRsbScpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmRvbWFpbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcuYXV0aGVudGljYXRpb24ub3B0aW9ucy5kb21haW5cIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudXNlck5hbWUgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb3B0aW9ucy51c2VyTmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcuYXV0aGVudGljYXRpb24ub3B0aW9ucy51c2VyTmFtZVwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5wYXNzd29yZCAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvcHRpb25zLnBhc3N3b3JkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5hdXRoZW50aWNhdGlvbi5vcHRpb25zLnBhc3N3b3JkXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF1dGhlbnRpY2F0aW9uID0ge1xuICAgICAgICAgIHR5cGU6ICdudGxtJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB1c2VyTmFtZTogb3B0aW9ucy51c2VyTmFtZSxcbiAgICAgICAgICAgIHBhc3N3b3JkOiBvcHRpb25zLnBhc3N3b3JkLFxuICAgICAgICAgICAgZG9tYWluOiBvcHRpb25zLmRvbWFpbiAmJiBvcHRpb25zLmRvbWFpbi50b1VwcGVyQ2FzZSgpXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAndG9rZW4tY3JlZGVudGlhbCcpIHtcbiAgICAgICAgaWYgKCFpc1Rva2VuQ3JlZGVudGlhbChvcHRpb25zLmNyZWRlbnRpYWwpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLmF1dGhlbnRpY2F0aW9uLm9wdGlvbnMuY3JlZGVudGlhbFwiIHByb3BlcnR5IG11c3QgYmUgYW4gaW5zdGFuY2Ugb2YgdGhlIHRva2VuIGNyZWRlbnRpYWwgY2xhc3MuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBhdXRoZW50aWNhdGlvbiA9IHtcbiAgICAgICAgICB0eXBlOiAndG9rZW4tY3JlZGVudGlhbCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgY3JlZGVudGlhbDogb3B0aW9ucy5jcmVkZW50aWFsXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1wYXNzd29yZCcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmNsaWVudElkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5hdXRoZW50aWNhdGlvbi5vcHRpb25zLmNsaWVudElkXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnVzZXJOYW1lICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9wdGlvbnMudXNlck5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLmF1dGhlbnRpY2F0aW9uLm9wdGlvbnMudXNlck5hbWVcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucGFzc3dvcmQgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb3B0aW9ucy5wYXNzd29yZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcuYXV0aGVudGljYXRpb24ub3B0aW9ucy5wYXNzd29yZFwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy50ZW5hbnRJZCAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvcHRpb25zLnRlbmFudElkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5hdXRoZW50aWNhdGlvbi5vcHRpb25zLnRlbmFudElkXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF1dGhlbnRpY2F0aW9uID0ge1xuICAgICAgICAgIHR5cGU6ICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LXBhc3N3b3JkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB1c2VyTmFtZTogb3B0aW9ucy51c2VyTmFtZSxcbiAgICAgICAgICAgIHBhc3N3b3JkOiBvcHRpb25zLnBhc3N3b3JkLFxuICAgICAgICAgICAgdGVuYW50SWQ6IG9wdGlvbnMudGVuYW50SWQsXG4gICAgICAgICAgICBjbGllbnRJZDogb3B0aW9ucy5jbGllbnRJZFxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktYWNjZXNzLXRva2VuJykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMudG9rZW4gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLmF1dGhlbnRpY2F0aW9uLm9wdGlvbnMudG9rZW5cIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXV0aGVudGljYXRpb24gPSB7XG4gICAgICAgICAgdHlwZTogJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktYWNjZXNzLXRva2VuJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0b2tlbjogb3B0aW9ucy50b2tlblxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktbXNpLXZtJykge1xuICAgICAgICBpZiAob3B0aW9ucy5jbGllbnRJZCAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvcHRpb25zLmNsaWVudElkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5hdXRoZW50aWNhdGlvbi5vcHRpb25zLmNsaWVudElkXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF1dGhlbnRpY2F0aW9uID0ge1xuICAgICAgICAgIHR5cGU6ICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LW1zaS12bScsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgY2xpZW50SWQ6IG9wdGlvbnMuY2xpZW50SWRcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LWRlZmF1bHQnKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmNsaWVudElkICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9wdGlvbnMuY2xpZW50SWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLmF1dGhlbnRpY2F0aW9uLm9wdGlvbnMuY2xpZW50SWRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG4gICAgICAgIGF1dGhlbnRpY2F0aW9uID0ge1xuICAgICAgICAgIHR5cGU6ICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LWRlZmF1bHQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGNsaWVudElkOiBvcHRpb25zLmNsaWVudElkXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1tc2ktYXBwLXNlcnZpY2UnKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmNsaWVudElkICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9wdGlvbnMuY2xpZW50SWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLmF1dGhlbnRpY2F0aW9uLm9wdGlvbnMuY2xpZW50SWRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXV0aGVudGljYXRpb24gPSB7XG4gICAgICAgICAgdHlwZTogJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktbXNpLWFwcC1zZXJ2aWNlJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBjbGllbnRJZDogb3B0aW9ucy5jbGllbnRJZFxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2F6dXJlLWFjdGl2ZS1kaXJlY3Rvcnktc2VydmljZS1wcmluY2lwYWwtc2VjcmV0Jykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuY2xpZW50SWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLmF1dGhlbnRpY2F0aW9uLm9wdGlvbnMuY2xpZW50SWRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmNsaWVudFNlY3JldCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcuYXV0aGVudGljYXRpb24ub3B0aW9ucy5jbGllbnRTZWNyZXRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnRlbmFudElkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5hdXRoZW50aWNhdGlvbi5vcHRpb25zLnRlbmFudElkXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF1dGhlbnRpY2F0aW9uID0ge1xuICAgICAgICAgIHR5cGU6ICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LXNlcnZpY2UtcHJpbmNpcGFsLXNlY3JldCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgY2xpZW50SWQ6IG9wdGlvbnMuY2xpZW50SWQsXG4gICAgICAgICAgICBjbGllbnRTZWNyZXQ6IG9wdGlvbnMuY2xpZW50U2VjcmV0LFxuICAgICAgICAgICAgdGVuYW50SWQ6IG9wdGlvbnMudGVuYW50SWRcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAob3B0aW9ucy51c2VyTmFtZSAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvcHRpb25zLnVzZXJOYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5hdXRoZW50aWNhdGlvbi5vcHRpb25zLnVzZXJOYW1lXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnBhc3N3b3JkICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9wdGlvbnMucGFzc3dvcmQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLmF1dGhlbnRpY2F0aW9uLm9wdGlvbnMucGFzc3dvcmRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXV0aGVudGljYXRpb24gPSB7XG4gICAgICAgICAgdHlwZTogJ2RlZmF1bHQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHVzZXJOYW1lOiBvcHRpb25zLnVzZXJOYW1lLFxuICAgICAgICAgICAgcGFzc3dvcmQ6IG9wdGlvbnMucGFzc3dvcmRcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGF1dGhlbnRpY2F0aW9uID0ge1xuICAgICAgICB0eXBlOiAnZGVmYXVsdCcsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICB1c2VyTmFtZTogdW5kZWZpbmVkLFxuICAgICAgICAgIHBhc3N3b3JkOiB1bmRlZmluZWRcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIHNlcnZlcjogY29uZmlnLnNlcnZlcixcbiAgICAgIGF1dGhlbnRpY2F0aW9uOiBhdXRoZW50aWNhdGlvbixcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgYWJvcnRUcmFuc2FjdGlvbk9uRXJyb3I6IGZhbHNlLFxuICAgICAgICBhcHBOYW1lOiB1bmRlZmluZWQsXG4gICAgICAgIGNhbWVsQ2FzZUNvbHVtbnM6IGZhbHNlLFxuICAgICAgICBjYW5jZWxUaW1lb3V0OiBERUZBVUxUX0NBTkNFTF9USU1FT1VULFxuICAgICAgICBjb2x1bW5FbmNyeXB0aW9uS2V5Q2FjaGVUVEw6IDIgKiA2MCAqIDYwICogMTAwMCwgIC8vIFVuaXRzOiBtaWxsaXNlY29uZHNcbiAgICAgICAgY29sdW1uRW5jcnlwdGlvblNldHRpbmc6IGZhbHNlLFxuICAgICAgICBjb2x1bW5OYW1lUmVwbGFjZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgY29ubmVjdGlvblJldHJ5SW50ZXJ2YWw6IERFRkFVTFRfQ09OTkVDVF9SRVRSWV9JTlRFUlZBTCxcbiAgICAgICAgY29ubmVjdFRpbWVvdXQ6IERFRkFVTFRfQ09OTkVDVF9USU1FT1VULFxuICAgICAgICBjb25uZWN0b3I6IHVuZGVmaW5lZCxcbiAgICAgICAgY29ubmVjdGlvbklzb2xhdGlvbkxldmVsOiBJU09MQVRJT05fTEVWRUwuUkVBRF9DT01NSVRURUQsXG4gICAgICAgIGNyeXB0b0NyZWRlbnRpYWxzRGV0YWlsczoge30sXG4gICAgICAgIGRhdGFiYXNlOiB1bmRlZmluZWQsXG4gICAgICAgIGRhdGVmaXJzdDogREVGQVVMVF9EQVRFRklSU1QsXG4gICAgICAgIGRhdGVGb3JtYXQ6IERFRkFVTFRfREFURUZPUk1BVCxcbiAgICAgICAgZGVidWc6IHtcbiAgICAgICAgICBkYXRhOiBmYWxzZSxcbiAgICAgICAgICBwYWNrZXQ6IGZhbHNlLFxuICAgICAgICAgIHBheWxvYWQ6IGZhbHNlLFxuICAgICAgICAgIHRva2VuOiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBlbmFibGVBbnNpTnVsbDogdHJ1ZSxcbiAgICAgICAgZW5hYmxlQW5zaU51bGxEZWZhdWx0OiB0cnVlLFxuICAgICAgICBlbmFibGVBbnNpUGFkZGluZzogdHJ1ZSxcbiAgICAgICAgZW5hYmxlQW5zaVdhcm5pbmdzOiB0cnVlLFxuICAgICAgICBlbmFibGVBcml0aEFib3J0OiB0cnVlLFxuICAgICAgICBlbmFibGVDb25jYXROdWxsWWllbGRzTnVsbDogdHJ1ZSxcbiAgICAgICAgZW5hYmxlQ3Vyc29yQ2xvc2VPbkNvbW1pdDogbnVsbCxcbiAgICAgICAgZW5hYmxlSW1wbGljaXRUcmFuc2FjdGlvbnM6IGZhbHNlLFxuICAgICAgICBlbmFibGVOdW1lcmljUm91bmRhYm9ydDogZmFsc2UsXG4gICAgICAgIGVuYWJsZVF1b3RlZElkZW50aWZpZXI6IHRydWUsXG4gICAgICAgIGVuY3J5cHQ6IHRydWUsXG4gICAgICAgIGZhbGxiYWNrVG9EZWZhdWx0RGI6IGZhbHNlLFxuICAgICAgICBlbmNyeXB0aW9uS2V5U3RvcmVQcm92aWRlcnM6IHVuZGVmaW5lZCxcbiAgICAgICAgaW5zdGFuY2VOYW1lOiB1bmRlZmluZWQsXG4gICAgICAgIGlzb2xhdGlvbkxldmVsOiBJU09MQVRJT05fTEVWRUwuUkVBRF9DT01NSVRURUQsXG4gICAgICAgIGxhbmd1YWdlOiBERUZBVUxUX0xBTkdVQUdFLFxuICAgICAgICBsb2NhbEFkZHJlc3M6IHVuZGVmaW5lZCxcbiAgICAgICAgbWF4UmV0cmllc09uVHJhbnNpZW50RXJyb3JzOiAzLFxuICAgICAgICBtdWx0aVN1Ym5ldEZhaWxvdmVyOiBmYWxzZSxcbiAgICAgICAgcGFja2V0U2l6ZTogREVGQVVMVF9QQUNLRVRfU0laRSxcbiAgICAgICAgcG9ydDogREVGQVVMVF9QT1JULFxuICAgICAgICByZWFkT25seUludGVudDogZmFsc2UsXG4gICAgICAgIHJlcXVlc3RUaW1lb3V0OiBERUZBVUxUX0NMSUVOVF9SRVFVRVNUX1RJTUVPVVQsXG4gICAgICAgIHJvd0NvbGxlY3Rpb25PbkRvbmU6IGZhbHNlLFxuICAgICAgICByb3dDb2xsZWN0aW9uT25SZXF1ZXN0Q29tcGxldGlvbjogZmFsc2UsXG4gICAgICAgIHNlcnZlck5hbWU6IHVuZGVmaW5lZCxcbiAgICAgICAgc2VydmVyU3VwcG9ydHNDb2x1bW5FbmNyeXB0aW9uOiBmYWxzZSxcbiAgICAgICAgdGRzVmVyc2lvbjogREVGQVVMVF9URFNfVkVSU0lPTixcbiAgICAgICAgdGV4dHNpemU6IERFRkFVTFRfVEVYVFNJWkUsXG4gICAgICAgIHRydXN0ZWRTZXJ2ZXJOYW1lQUU6IHVuZGVmaW5lZCxcbiAgICAgICAgdHJ1c3RTZXJ2ZXJDZXJ0aWZpY2F0ZTogZmFsc2UsXG4gICAgICAgIHVzZUNvbHVtbk5hbWVzOiBmYWxzZSxcbiAgICAgICAgdXNlVVRDOiB0cnVlLFxuICAgICAgICB3b3Jrc3RhdGlvbklkOiB1bmRlZmluZWQsXG4gICAgICAgIGxvd2VyQ2FzZUd1aWRzOiBmYWxzZVxuICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoY29uZmlnLm9wdGlvbnMpIHtcbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5wb3J0ICYmIGNvbmZpZy5vcHRpb25zLmluc3RhbmNlTmFtZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BvcnQgYW5kIGluc3RhbmNlTmFtZSBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlLCBidXQgJyArIGNvbmZpZy5vcHRpb25zLnBvcnQgKyAnIGFuZCAnICsgY29uZmlnLm9wdGlvbnMuaW5zdGFuY2VOYW1lICsgJyBwcm92aWRlZCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuYWJvcnRUcmFuc2FjdGlvbk9uRXJyb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmFib3J0VHJhbnNhY3Rpb25PbkVycm9yICE9PSAnYm9vbGVhbicgJiYgY29uZmlnLm9wdGlvbnMuYWJvcnRUcmFuc2FjdGlvbk9uRXJyb3IgIT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5hYm9ydFRyYW5zYWN0aW9uT25FcnJvclwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcgb3IgbnVsbC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuYWJvcnRUcmFuc2FjdGlvbk9uRXJyb3IgPSBjb25maWcub3B0aW9ucy5hYm9ydFRyYW5zYWN0aW9uT25FcnJvcjtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmFwcE5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmFwcE5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuYXBwTmFtZVwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmFwcE5hbWUgPSBjb25maWcub3B0aW9ucy5hcHBOYW1lO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuY2FtZWxDYXNlQ29sdW1ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuY2FtZWxDYXNlQ29sdW1ucyAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuY2FtZWxDYXNlQ29sdW1uc1wiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5jYW1lbENhc2VDb2x1bW5zID0gY29uZmlnLm9wdGlvbnMuY2FtZWxDYXNlQ29sdW1ucztcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmNhbmNlbFRpbWVvdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmNhbmNlbFRpbWVvdXQgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuY2FuY2VsVGltZW91dFwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBudW1iZXIuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmNhbmNlbFRpbWVvdXQgPSBjb25maWcub3B0aW9ucy5jYW5jZWxUaW1lb3V0O1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuY29sdW1uTmFtZVJlcGxhY2VyKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuY29sdW1uTmFtZVJlcGxhY2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuY2FuY2VsVGltZW91dFwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBmdW5jdGlvbi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuY29sdW1uTmFtZVJlcGxhY2VyID0gY29uZmlnLm9wdGlvbnMuY29sdW1uTmFtZVJlcGxhY2VyO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuY29ubmVjdGlvbklzb2xhdGlvbkxldmVsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXNzZXJ0VmFsaWRJc29sYXRpb25MZXZlbChjb25maWcub3B0aW9ucy5jb25uZWN0aW9uSXNvbGF0aW9uTGV2ZWwsICdjb25maWcub3B0aW9ucy5jb25uZWN0aW9uSXNvbGF0aW9uTGV2ZWwnKTtcblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmNvbm5lY3Rpb25Jc29sYXRpb25MZXZlbCA9IGNvbmZpZy5vcHRpb25zLmNvbm5lY3Rpb25Jc29sYXRpb25MZXZlbDtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmNvbm5lY3RUaW1lb3V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5jb25uZWN0VGltZW91dCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5jb25uZWN0VGltZW91dFwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBudW1iZXIuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmNvbm5lY3RUaW1lb3V0ID0gY29uZmlnLm9wdGlvbnMuY29ubmVjdFRpbWVvdXQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5jb25uZWN0b3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmNvbm5lY3RvciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLmNvbm5lY3RvclwiIHByb3BlcnR5IG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuY29ubmVjdG9yID0gY29uZmlnLm9wdGlvbnMuY29ubmVjdG9yO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuY3J5cHRvQ3JlZGVudGlhbHNEZXRhaWxzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5jcnlwdG9DcmVkZW50aWFsc0RldGFpbHMgIT09ICdvYmplY3QnIHx8IGNvbmZpZy5vcHRpb25zLmNyeXB0b0NyZWRlbnRpYWxzRGV0YWlscyA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLmNyeXB0b0NyZWRlbnRpYWxzRGV0YWlsc1wiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBPYmplY3QuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmNyeXB0b0NyZWRlbnRpYWxzRGV0YWlscyA9IGNvbmZpZy5vcHRpb25zLmNyeXB0b0NyZWRlbnRpYWxzRGV0YWlscztcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmRhdGFiYXNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5kYXRhYmFzZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5kYXRhYmFzZVwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmRhdGFiYXNlID0gY29uZmlnLm9wdGlvbnMuZGF0YWJhc2U7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5kYXRlZmlyc3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmRhdGVmaXJzdCAhPT0gJ251bWJlcicgJiYgY29uZmlnLm9wdGlvbnMuZGF0ZWZpcnN0ICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZGF0ZWZpcnN0XCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIG51bWJlci4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcub3B0aW9ucy5kYXRlZmlyc3QgIT09IG51bGwgJiYgKGNvbmZpZy5vcHRpb25zLmRhdGVmaXJzdCA8IDEgfHwgY29uZmlnLm9wdGlvbnMuZGF0ZWZpcnN0ID4gNykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZGF0ZWZpcnN0XCIgcHJvcGVydHkgbXVzdCBiZSA+PSAxIGFuZCA8PSA3Jyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmRhdGVmaXJzdCA9IGNvbmZpZy5vcHRpb25zLmRhdGVmaXJzdDtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmRhdGVGb3JtYXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmRhdGVGb3JtYXQgIT09ICdzdHJpbmcnICYmIGNvbmZpZy5vcHRpb25zLmRhdGVGb3JtYXQgIT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5kYXRlRm9ybWF0XCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIHN0cmluZyBvciBudWxsLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5kYXRlRm9ybWF0ID0gY29uZmlnLm9wdGlvbnMuZGF0ZUZvcm1hdDtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmRlYnVnKSB7XG4gICAgICAgIGlmIChjb25maWcub3B0aW9ucy5kZWJ1Zy5kYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmRlYnVnLmRhdGEgIT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZGVidWcuZGF0YVwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuZGVidWcuZGF0YSA9IGNvbmZpZy5vcHRpb25zLmRlYnVnLmRhdGE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29uZmlnLm9wdGlvbnMuZGVidWcucGFja2V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmRlYnVnLnBhY2tldCAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5kZWJ1Zy5wYWNrZXRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgYm9vbGVhbi4nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmRlYnVnLnBhY2tldCA9IGNvbmZpZy5vcHRpb25zLmRlYnVnLnBhY2tldDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcub3B0aW9ucy5kZWJ1Zy5wYXlsb2FkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmRlYnVnLnBheWxvYWQgIT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZGVidWcucGF5bG9hZFwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuZGVidWcucGF5bG9hZCA9IGNvbmZpZy5vcHRpb25zLmRlYnVnLnBheWxvYWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29uZmlnLm9wdGlvbnMuZGVidWcudG9rZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuZGVidWcudG9rZW4gIT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZGVidWcudG9rZW5cIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgYm9vbGVhbi4nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmRlYnVnLnRva2VuID0gY29uZmlnLm9wdGlvbnMuZGVidWcudG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lOdWxsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5lbmFibGVBbnNpTnVsbCAhPT0gJ2Jvb2xlYW4nICYmIGNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lOdWxsICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaU51bGxcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgYm9vbGVhbiBvciBudWxsLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVBbnNpTnVsbCA9IGNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lOdWxsO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaU51bGxEZWZhdWx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5lbmFibGVBbnNpTnVsbERlZmF1bHQgIT09ICdib29sZWFuJyAmJiBjb25maWcub3B0aW9ucy5lbmFibGVBbnNpTnVsbERlZmF1bHQgIT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5lbmFibGVBbnNpTnVsbERlZmF1bHRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgYm9vbGVhbiBvciBudWxsLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVBbnNpTnVsbERlZmF1bHQgPSBjb25maWcub3B0aW9ucy5lbmFibGVBbnNpTnVsbERlZmF1bHQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5lbmFibGVBbnNpUGFkZGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaVBhZGRpbmcgIT09ICdib29sZWFuJyAmJiBjb25maWcub3B0aW9ucy5lbmFibGVBbnNpUGFkZGluZyAhPT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lQYWRkaW5nXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIGJvb2xlYW4gb3IgbnVsbC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaVBhZGRpbmcgPSBjb25maWcub3B0aW9ucy5lbmFibGVBbnNpUGFkZGluZztcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lXYXJuaW5ncyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaVdhcm5pbmdzICE9PSAnYm9vbGVhbicgJiYgY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaVdhcm5pbmdzICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaVdhcm5pbmdzXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIGJvb2xlYW4gb3IgbnVsbC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaVdhcm5pbmdzID0gY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaVdhcm5pbmdzO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuZW5hYmxlQXJpdGhBYm9ydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuZW5hYmxlQXJpdGhBYm9ydCAhPT0gJ2Jvb2xlYW4nICYmIGNvbmZpZy5vcHRpb25zLmVuYWJsZUFyaXRoQWJvcnQgIT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5lbmFibGVBcml0aEFib3J0XCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIGJvb2xlYW4gb3IgbnVsbC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlQXJpdGhBYm9ydCA9IGNvbmZpZy5vcHRpb25zLmVuYWJsZUFyaXRoQWJvcnQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5lbmFibGVDb25jYXROdWxsWWllbGRzTnVsbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuZW5hYmxlQ29uY2F0TnVsbFlpZWxkc051bGwgIT09ICdib29sZWFuJyAmJiBjb25maWcub3B0aW9ucy5lbmFibGVDb25jYXROdWxsWWllbGRzTnVsbCAhPT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLmVuYWJsZUNvbmNhdE51bGxZaWVsZHNOdWxsXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIGJvb2xlYW4gb3IgbnVsbC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlQ29uY2F0TnVsbFlpZWxkc051bGwgPSBjb25maWcub3B0aW9ucy5lbmFibGVDb25jYXROdWxsWWllbGRzTnVsbDtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmVuYWJsZUN1cnNvckNsb3NlT25Db21taXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmVuYWJsZUN1cnNvckNsb3NlT25Db21taXQgIT09ICdib29sZWFuJyAmJiBjb25maWcub3B0aW9ucy5lbmFibGVDdXJzb3JDbG9zZU9uQ29tbWl0ICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZW5hYmxlQ3Vyc29yQ2xvc2VPbkNvbW1pdFwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuIG9yIG51bGwuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZUN1cnNvckNsb3NlT25Db21taXQgPSBjb25maWcub3B0aW9ucy5lbmFibGVDdXJzb3JDbG9zZU9uQ29tbWl0O1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuZW5hYmxlSW1wbGljaXRUcmFuc2FjdGlvbnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmVuYWJsZUltcGxpY2l0VHJhbnNhY3Rpb25zICE9PSAnYm9vbGVhbicgJiYgY29uZmlnLm9wdGlvbnMuZW5hYmxlSW1wbGljaXRUcmFuc2FjdGlvbnMgIT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5lbmFibGVJbXBsaWNpdFRyYW5zYWN0aW9uc1wiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuIG9yIG51bGwuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZUltcGxpY2l0VHJhbnNhY3Rpb25zID0gY29uZmlnLm9wdGlvbnMuZW5hYmxlSW1wbGljaXRUcmFuc2FjdGlvbnM7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5lbmFibGVOdW1lcmljUm91bmRhYm9ydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuZW5hYmxlTnVtZXJpY1JvdW5kYWJvcnQgIT09ICdib29sZWFuJyAmJiBjb25maWcub3B0aW9ucy5lbmFibGVOdW1lcmljUm91bmRhYm9ydCAhPT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLmVuYWJsZU51bWVyaWNSb3VuZGFib3J0XCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIGJvb2xlYW4gb3IgbnVsbC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlTnVtZXJpY1JvdW5kYWJvcnQgPSBjb25maWcub3B0aW9ucy5lbmFibGVOdW1lcmljUm91bmRhYm9ydDtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmVuYWJsZVF1b3RlZElkZW50aWZpZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmVuYWJsZVF1b3RlZElkZW50aWZpZXIgIT09ICdib29sZWFuJyAmJiBjb25maWcub3B0aW9ucy5lbmFibGVRdW90ZWRJZGVudGlmaWVyICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZW5hYmxlUXVvdGVkSWRlbnRpZmllclwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuIG9yIG51bGwuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZVF1b3RlZElkZW50aWZpZXIgPSBjb25maWcub3B0aW9ucy5lbmFibGVRdW90ZWRJZGVudGlmaWVyO1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmVuY3J5cHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmVuY3J5cHQgIT09ICdib29sZWFuJykge1xuICAgICAgICAgIGlmIChjb25maWcub3B0aW9ucy5lbmNyeXB0ICE9PSAnc3RyaWN0Jykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiZW5jcnlwdFwiIHByb3BlcnR5IG11c3QgYmUgc2V0IHRvIFwic3RyaWN0XCIsIG9yIG9mIHR5cGUgYm9vbGVhbi4nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmVuY3J5cHQgPSBjb25maWcub3B0aW9ucy5lbmNyeXB0O1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuZmFsbGJhY2tUb0RlZmF1bHREYiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuZmFsbGJhY2tUb0RlZmF1bHREYiAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuZmFsbGJhY2tUb0RlZmF1bHREYlwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5mYWxsYmFja1RvRGVmYXVsdERiID0gY29uZmlnLm9wdGlvbnMuZmFsbGJhY2tUb0RlZmF1bHREYjtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmluc3RhbmNlTmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuaW5zdGFuY2VOYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLmluc3RhbmNlTmFtZVwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmluc3RhbmNlTmFtZSA9IGNvbmZpZy5vcHRpb25zLmluc3RhbmNlTmFtZTtcbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5wb3J0ID0gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuaXNvbGF0aW9uTGV2ZWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhc3NlcnRWYWxpZElzb2xhdGlvbkxldmVsKGNvbmZpZy5vcHRpb25zLmlzb2xhdGlvbkxldmVsLCAnY29uZmlnLm9wdGlvbnMuaXNvbGF0aW9uTGV2ZWwnKTtcblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmlzb2xhdGlvbkxldmVsID0gY29uZmlnLm9wdGlvbnMuaXNvbGF0aW9uTGV2ZWw7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5sYW5ndWFnZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMubGFuZ3VhZ2UgIT09ICdzdHJpbmcnICYmIGNvbmZpZy5vcHRpb25zLmxhbmd1YWdlICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMubGFuZ3VhZ2VcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nIG9yIG51bGwuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLmxhbmd1YWdlID0gY29uZmlnLm9wdGlvbnMubGFuZ3VhZ2U7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5sb2NhbEFkZHJlc3MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmxvY2FsQWRkcmVzcyAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5sb2NhbEFkZHJlc3NcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5sb2NhbEFkZHJlc3MgPSBjb25maWcub3B0aW9ucy5sb2NhbEFkZHJlc3M7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5tdWx0aVN1Ym5ldEZhaWxvdmVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5tdWx0aVN1Ym5ldEZhaWxvdmVyICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5tdWx0aVN1Ym5ldEZhaWxvdmVyXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIGJvb2xlYW4uJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLm11bHRpU3VibmV0RmFpbG92ZXIgPSBjb25maWcub3B0aW9ucy5tdWx0aVN1Ym5ldEZhaWxvdmVyO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMucGFja2V0U2l6ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMucGFja2V0U2l6ZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5wYWNrZXRTaXplXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIG51bWJlci4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMucGFja2V0U2l6ZSA9IGNvbmZpZy5vcHRpb25zLnBhY2tldFNpemU7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5wb3J0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5wb3J0ICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLnBvcnRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgbnVtYmVyLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLnBvcnQgPD0gMCB8fCBjb25maWcub3B0aW9ucy5wb3J0ID49IDY1NTM2KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLnBvcnRcIiBwcm9wZXJ0eSBtdXN0IGJlID4gMCBhbmQgPCA2NTUzNicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5wb3J0ID0gY29uZmlnLm9wdGlvbnMucG9ydDtcbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5pbnN0YW5jZU5hbWUgPSB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5yZWFkT25seUludGVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMucmVhZE9ubHlJbnRlbnQgIT09ICdib29sZWFuJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLnJlYWRPbmx5SW50ZW50XCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIGJvb2xlYW4uJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLnJlYWRPbmx5SW50ZW50ID0gY29uZmlnLm9wdGlvbnMucmVhZE9ubHlJbnRlbnQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy5yZXF1ZXN0VGltZW91dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMucmVxdWVzdFRpbWVvdXQgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMucmVxdWVzdFRpbWVvdXRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgbnVtYmVyLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5yZXF1ZXN0VGltZW91dCA9IGNvbmZpZy5vcHRpb25zLnJlcXVlc3RUaW1lb3V0O1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMubWF4UmV0cmllc09uVHJhbnNpZW50RXJyb3JzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5tYXhSZXRyaWVzT25UcmFuc2llbnRFcnJvcnMgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMubWF4UmV0cmllc09uVHJhbnNpZW50RXJyb3JzXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIG51bWJlci4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcub3B0aW9ucy5tYXhSZXRyaWVzT25UcmFuc2llbnRFcnJvcnMgPCAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMubWF4UmV0cmllc09uVHJhbnNpZW50RXJyb3JzXCIgcHJvcGVydHkgbXVzdCBiZSBlcXVhbCBvciBncmVhdGVyIHRoYW4gMC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMubWF4UmV0cmllc09uVHJhbnNpZW50RXJyb3JzID0gY29uZmlnLm9wdGlvbnMubWF4UmV0cmllc09uVHJhbnNpZW50RXJyb3JzO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuY29ubmVjdGlvblJldHJ5SW50ZXJ2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLmNvbm5lY3Rpb25SZXRyeUludGVydmFsICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLmNvbm5lY3Rpb25SZXRyeUludGVydmFsXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIG51bWJlci4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcub3B0aW9ucy5jb25uZWN0aW9uUmV0cnlJbnRlcnZhbCA8PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMuY29ubmVjdGlvblJldHJ5SW50ZXJ2YWxcIiBwcm9wZXJ0eSBtdXN0IGJlIGdyZWF0ZXIgdGhhbiAwLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5jb25uZWN0aW9uUmV0cnlJbnRlcnZhbCA9IGNvbmZpZy5vcHRpb25zLmNvbm5lY3Rpb25SZXRyeUludGVydmFsO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMucm93Q29sbGVjdGlvbk9uRG9uZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMucm93Q29sbGVjdGlvbk9uRG9uZSAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMucm93Q29sbGVjdGlvbk9uRG9uZVwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy5yb3dDb2xsZWN0aW9uT25Eb25lID0gY29uZmlnLm9wdGlvbnMucm93Q29sbGVjdGlvbk9uRG9uZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLnJvd0NvbGxlY3Rpb25PblJlcXVlc3RDb21wbGV0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5yb3dDb2xsZWN0aW9uT25SZXF1ZXN0Q29tcGxldGlvbiAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMucm93Q29sbGVjdGlvbk9uUmVxdWVzdENvbXBsZXRpb25cIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgYm9vbGVhbi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMucm93Q29sbGVjdGlvbk9uUmVxdWVzdENvbXBsZXRpb24gPSBjb25maWcub3B0aW9ucy5yb3dDb2xsZWN0aW9uT25SZXF1ZXN0Q29tcGxldGlvbjtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLnRkc1ZlcnNpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLnRkc1ZlcnNpb24gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMudGRzVmVyc2lvblwiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLnRkc1ZlcnNpb24gPSBjb25maWcub3B0aW9ucy50ZHNWZXJzaW9uO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMudGV4dHNpemUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLnRleHRzaXplICE9PSAnbnVtYmVyJyAmJiBjb25maWcub3B0aW9ucy50ZXh0c2l6ZSAhPT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLnRleHRzaXplXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIG51bWJlciBvciBudWxsLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLnRleHRzaXplID4gMjE0NzQ4MzY0Nykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLnRleHRzaXplXCIgY2FuXFwndCBiZSBncmVhdGVyIHRoYW4gMjE0NzQ4MzY0Ny4nKTtcbiAgICAgICAgfSBlbHNlIGlmIChjb25maWcub3B0aW9ucy50ZXh0c2l6ZSA8IC0xKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMudGV4dHNpemVcIiBjYW5cXCd0IGJlIHNtYWxsZXIgdGhhbiAtMS4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMudGV4dHNpemUgPSBjb25maWcub3B0aW9ucy50ZXh0c2l6ZSB8IDA7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy50cnVzdFNlcnZlckNlcnRpZmljYXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy50cnVzdFNlcnZlckNlcnRpZmljYXRlICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy50cnVzdFNlcnZlckNlcnRpZmljYXRlXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIGJvb2xlYW4uJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLnRydXN0U2VydmVyQ2VydGlmaWNhdGUgPSBjb25maWcub3B0aW9ucy50cnVzdFNlcnZlckNlcnRpZmljYXRlO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMuc2VydmVyTmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLm9wdGlvbnMuc2VydmVyTmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy5zZXJ2ZXJOYW1lXCIgcHJvcGVydHkgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4nKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbmZpZy5vcHRpb25zLnNlcnZlck5hbWUgPSBjb25maWcub3B0aW9ucy5zZXJ2ZXJOYW1lO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMudXNlQ29sdW1uTmFtZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5vcHRpb25zLnVzZUNvbHVtbk5hbWVzICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgXCJjb25maWcub3B0aW9ucy51c2VDb2x1bW5OYW1lc1wiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy51c2VDb2x1bW5OYW1lcyA9IGNvbmZpZy5vcHRpb25zLnVzZUNvbHVtbk5hbWVzO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9wdGlvbnMudXNlVVRDICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy51c2VVVEMgIT09ICdib29sZWFuJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLnVzZVVUQ1wiIHByb3BlcnR5IG11c3QgYmUgb2YgdHlwZSBib29sZWFuLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy51c2VVVEMgPSBjb25maWcub3B0aW9ucy51c2VVVEM7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcub3B0aW9ucy53b3Jrc3RhdGlvbklkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy53b3Jrc3RhdGlvbklkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcImNvbmZpZy5vcHRpb25zLndvcmtzdGF0aW9uSWRcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcub3B0aW9ucy53b3Jrc3RhdGlvbklkID0gY29uZmlnLm9wdGlvbnMud29ya3N0YXRpb25JZDtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLmxvd2VyQ2FzZUd1aWRzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcub3B0aW9ucy5sb3dlckNhc2VHdWlkcyAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIFwiY29uZmlnLm9wdGlvbnMubG93ZXJDYXNlR3VpZHNcIiBwcm9wZXJ0eSBtdXN0IGJlIG9mIHR5cGUgYm9vbGVhbi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnLm9wdGlvbnMubG93ZXJDYXNlR3VpZHMgPSBjb25maWcub3B0aW9ucy5sb3dlckNhc2VHdWlkcztcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNlY3VyZUNvbnRleHRPcHRpb25zID0gdGhpcy5jb25maWcub3B0aW9ucy5jcnlwdG9DcmVkZW50aWFsc0RldGFpbHM7XG4gICAgaWYgKHRoaXMuc2VjdXJlQ29udGV4dE9wdGlvbnMuc2VjdXJlT3B0aW9ucyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBJZiB0aGUgY2FsbGVyIGhhcyBub3Qgc3BlY2lmaWVkIHRoZWlyIG93biBgc2VjdXJlT3B0aW9uc2AsXG4gICAgICAvLyB3ZSBzZXQgYFNTTF9PUF9ET05UX0lOU0VSVF9FTVBUWV9GUkFHTUVOVFNgIGhlcmUuXG4gICAgICAvLyBPbGRlciBTUUwgU2VydmVyIGluc3RhbmNlcyBydW5uaW5nIG9uIG9sZGVyIFdpbmRvd3MgdmVyc2lvbnMgaGF2ZVxuICAgICAgLy8gdHJvdWJsZSB3aXRoIHRoZSBCRUFTVCB3b3JrYXJvdW5kIGluIE9wZW5TU0wuXG4gICAgICAvLyBBcyBCRUFTVCBpcyBhIGJyb3dzZXIgc3BlY2lmaWMgZXhwbG9pdCwgd2UgY2FuIGp1c3QgZGlzYWJsZSB0aGlzIG9wdGlvbiBoZXJlLlxuICAgICAgdGhpcy5zZWN1cmVDb250ZXh0T3B0aW9ucyA9IE9iamVjdC5jcmVhdGUodGhpcy5zZWN1cmVDb250ZXh0T3B0aW9ucywge1xuICAgICAgICBzZWN1cmVPcHRpb25zOiB7XG4gICAgICAgICAgdmFsdWU6IGNvbnN0YW50cy5TU0xfT1BfRE9OVF9JTlNFUlRfRU1QVFlfRlJBR01FTlRTXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuZGVidWcgPSB0aGlzLmNyZWF0ZURlYnVnKCk7XG4gICAgdGhpcy5pblRyYW5zYWN0aW9uID0gZmFsc2U7XG4gICAgdGhpcy50cmFuc2FjdGlvbkRlc2NyaXB0b3JzID0gW0J1ZmZlci5mcm9tKFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSldO1xuXG4gICAgLy8gJ2JlZ2luVHJhbnNhY3Rpb24nLCAnY29tbWl0VHJhbnNhY3Rpb24nIGFuZCAncm9sbGJhY2tUcmFuc2FjdGlvbidcbiAgICAvLyBldmVudHMgYXJlIHV0aWxpemVkIHRvIG1haW50YWluIGluVHJhbnNhY3Rpb24gcHJvcGVydHkgc3RhdGUgd2hpY2ggaW5cbiAgICAvLyB0dXJuIGlzIHVzZWQgaW4gbWFuYWdpbmcgdHJhbnNhY3Rpb25zLiBUaGVzZSBldmVudHMgYXJlIG9ubHkgZmlyZWQgZm9yXG4gICAgLy8gVERTIHZlcnNpb24gNy4yIGFuZCBiZXlvbmQuIFRoZSBwcm9wZXJ0aWVzIGJlbG93IGFyZSB1c2VkIHRvIGVtdWxhdGVcbiAgICAvLyBlcXVpdmFsZW50IGJlaGF2aW9yIGZvciBURFMgdmVyc2lvbnMgYmVmb3JlIDcuMi5cbiAgICB0aGlzLnRyYW5zYWN0aW9uRGVwdGggPSAwO1xuICAgIHRoaXMuaXNTcWxCYXRjaCA9IGZhbHNlO1xuICAgIHRoaXMuY2xvc2VkID0gZmFsc2U7XG4gICAgdGhpcy5tZXNzYWdlQnVmZmVyID0gQnVmZmVyLmFsbG9jKDApO1xuXG4gICAgdGhpcy5jdXJUcmFuc2llbnRSZXRyeUNvdW50ID0gMDtcbiAgICB0aGlzLnRyYW5zaWVudEVycm9yTG9va3VwID0gbmV3IFRyYW5zaWVudEVycm9yTG9va3VwKCk7XG5cbiAgICB0aGlzLnN0YXRlID0gdGhpcy5TVEFURS5JTklUSUFMSVpFRDtcblxuICAgIHRoaXMuX2NhbmNlbEFmdGVyUmVxdWVzdFNlbnQgPSAoKSA9PiB7XG4gICAgICB0aGlzLm1lc3NhZ2VJby5zZW5kTWVzc2FnZShUWVBFLkFUVEVOVElPTik7XG4gICAgICB0aGlzLmNyZWF0ZUNhbmNlbFRpbWVyKCk7XG4gICAgfTtcbiAgfVxuXG4gIGNvbm5lY3QoY29ubmVjdExpc3RlbmVyPzogKGVycj86IEVycm9yKSA9PiB2b2lkKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgIT09IHRoaXMuU1RBVEUuSU5JVElBTElaRUQpIHtcbiAgICAgIHRocm93IG5ldyBDb25uZWN0aW9uRXJyb3IoJ2AuY29ubmVjdGAgY2FuIG5vdCBiZSBjYWxsZWQgb24gYSBDb25uZWN0aW9uIGluIGAnICsgdGhpcy5zdGF0ZS5uYW1lICsgJ2Agc3RhdGUuJyk7XG4gICAgfVxuXG4gICAgaWYgKGNvbm5lY3RMaXN0ZW5lcikge1xuICAgICAgY29uc3Qgb25Db25uZWN0ID0gKGVycj86IEVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25FcnJvcik7XG4gICAgICAgIGNvbm5lY3RMaXN0ZW5lcihlcnIpO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25FcnJvciA9IChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2Nvbm5lY3QnLCBvbkNvbm5lY3QpO1xuICAgICAgICBjb25uZWN0TGlzdGVuZXIoZXJyKTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMub25jZSgnY29ubmVjdCcsIG9uQ29ubmVjdCk7XG4gICAgICB0aGlzLm9uY2UoJ2Vycm9yJywgb25FcnJvcik7XG4gICAgfVxuXG4gICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5DT05ORUNUSU5HKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc2VydmVyIGhhcyByZXBvcnRlZCB0aGF0IHRoZSBjaGFyc2V0IGhhcyBjaGFuZ2VkLlxuICAgKi9cbiAgb24oZXZlbnQ6ICdjaGFyc2V0Q2hhbmdlJywgbGlzdGVuZXI6IChjaGFyc2V0OiBzdHJpbmcpID0+IHZvaWQpOiB0aGlzXG5cbiAgLyoqXG4gICAqIFRoZSBhdHRlbXB0IHRvIGNvbm5lY3QgYW5kIHZhbGlkYXRlIGhhcyBjb21wbGV0ZWQuXG4gICAqL1xuICBvbihcbiAgICBldmVudDogJ2Nvbm5lY3QnLFxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBlcnIgSWYgc3VjY2Vzc2Z1bGx5IGNvbm5lY3RlZCwgd2lsbCBiZSBmYWxzZXkuIElmIHRoZXJlIHdhcyBhXG4gICAgICogICBwcm9ibGVtICh3aXRoIGVpdGhlciBjb25uZWN0aW5nIG9yIHZhbGlkYXRpb24pLCB3aWxsIGJlIGFuIFtbRXJyb3JdXSBvYmplY3QuXG4gICAgICovXG4gICAgbGlzdGVuZXI6IChlcnI6IEVycm9yIHwgdW5kZWZpbmVkKSA9PiB2b2lkXG4gICk6IHRoaXNcblxuICAvKipcbiAgICogVGhlIHNlcnZlciBoYXMgcmVwb3J0ZWQgdGhhdCB0aGUgYWN0aXZlIGRhdGFiYXNlIGhhcyBjaGFuZ2VkLlxuICAgKiBUaGlzIG1heSBiZSBhcyBhIHJlc3VsdCBvZiBhIHN1Y2Nlc3NmdWwgbG9naW4sIG9yIGEgYHVzZWAgc3RhdGVtZW50LlxuICAgKi9cbiAgb24oZXZlbnQ6ICdkYXRhYmFzZUNoYW5nZScsIGxpc3RlbmVyOiAoZGF0YWJhc2VOYW1lOiBzdHJpbmcpID0+IHZvaWQpOiB0aGlzXG5cbiAgLyoqXG4gICAqIEEgZGVidWcgbWVzc2FnZSBpcyBhdmFpbGFibGUuIEl0IG1heSBiZSBsb2dnZWQgb3IgaWdub3JlZC5cbiAgICovXG4gIG9uKGV2ZW50OiAnZGVidWcnLCBsaXN0ZW5lcjogKG1lc3NhZ2VUZXh0OiBzdHJpbmcpID0+IHZvaWQpOiB0aGlzXG5cbiAgLyoqXG4gICAqIEludGVybmFsIGVycm9yIG9jY3Vycy5cbiAgICovXG4gIG9uKGV2ZW50OiAnZXJyb3InLCBsaXN0ZW5lcjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXG5cbiAgLyoqXG4gICAqIFRoZSBzZXJ2ZXIgaGFzIGlzc3VlZCBhbiBlcnJvciBtZXNzYWdlLlxuICAgKi9cbiAgb24oZXZlbnQ6ICdlcnJvck1lc3NhZ2UnLCBsaXN0ZW5lcjogKG1lc3NhZ2U6IGltcG9ydCgnLi90b2tlbi90b2tlbicpLkVycm9yTWVzc2FnZVRva2VuKSA9PiB2b2lkKTogdGhpc1xuXG4gIC8qKlxuICAgKiBUaGUgY29ubmVjdGlvbiBoYXMgZW5kZWQuXG4gICAqXG4gICAqIFRoaXMgbWF5IGJlIGFzIGEgcmVzdWx0IG9mIHRoZSBjbGllbnQgY2FsbGluZyBbW2Nsb3NlXV0sIHRoZSBzZXJ2ZXJcbiAgICogY2xvc2luZyB0aGUgY29ubmVjdGlvbiwgb3IgYSBuZXR3b3JrIGVycm9yLlxuICAgKi9cbiAgb24oZXZlbnQ6ICdlbmQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXNcblxuICAvKipcbiAgICogVGhlIHNlcnZlciBoYXMgaXNzdWVkIGFuIGluZm9ybWF0aW9uIG1lc3NhZ2UuXG4gICAqL1xuICBvbihldmVudDogJ2luZm9NZXNzYWdlJywgbGlzdGVuZXI6IChtZXNzYWdlOiBpbXBvcnQoJy4vdG9rZW4vdG9rZW4nKS5JbmZvTWVzc2FnZVRva2VuKSA9PiB2b2lkKTogdGhpc1xuXG4gIC8qKlxuICAgKiBUaGUgc2VydmVyIGhhcyByZXBvcnRlZCB0aGF0IHRoZSBsYW5ndWFnZSBoYXMgY2hhbmdlZC5cbiAgICovXG4gIG9uKGV2ZW50OiAnbGFuZ3VhZ2VDaGFuZ2UnLCBsaXN0ZW5lcjogKGxhbmd1YWdlTmFtZTogc3RyaW5nKSA9PiB2b2lkKTogdGhpc1xuXG4gIC8qKlxuICAgKiBUaGUgY29ubmVjdGlvbiB3YXMgcmVzZXQuXG4gICAqL1xuICBvbihldmVudDogJ3Jlc2V0Q29ubmVjdGlvbicsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpc1xuXG4gIC8qKlxuICAgKiBBIHNlY3VyZSBjb25uZWN0aW9uIGhhcyBiZWVuIGVzdGFibGlzaGVkLlxuICAgKi9cbiAgb24oZXZlbnQ6ICdzZWN1cmUnLCBsaXN0ZW5lcjogKGNsZWFydGV4dDogaW1wb3J0KCd0bHMnKS5UTFNTb2NrZXQpID0+IHZvaWQpOiB0aGlzXG5cbiAgb24oZXZlbnQ6IHN0cmluZyB8IHN5bWJvbCwgbGlzdGVuZXI6ICguLi5hcmdzOiBhbnlbXSkgPT4gdm9pZCkge1xuICAgIHJldHVybiBzdXBlci5vbihldmVudCwgbGlzdGVuZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBlbWl0KGV2ZW50OiAnY2hhcnNldENoYW5nZScsIGNoYXJzZXQ6IHN0cmluZyk6IGJvb2xlYW5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBlbWl0KGV2ZW50OiAnY29ubmVjdCcsIGVycm9yPzogRXJyb3IpOiBib29sZWFuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZW1pdChldmVudDogJ2RhdGFiYXNlQ2hhbmdlJywgZGF0YWJhc2VOYW1lOiBzdHJpbmcpOiBib29sZWFuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZW1pdChldmVudDogJ2RlYnVnJywgbWVzc2FnZVRleHQ6IHN0cmluZyk6IGJvb2xlYW5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBlbWl0KGV2ZW50OiAnZXJyb3InLCBlcnJvcjogRXJyb3IpOiBib29sZWFuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZW1pdChldmVudDogJ2Vycm9yTWVzc2FnZScsIG1lc3NhZ2U6IGltcG9ydCgnLi90b2tlbi90b2tlbicpLkVycm9yTWVzc2FnZVRva2VuKTogYm9vbGVhblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGVtaXQoZXZlbnQ6ICdlbmQnKTogYm9vbGVhblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGVtaXQoZXZlbnQ6ICdpbmZvTWVzc2FnZScsIG1lc3NhZ2U6IGltcG9ydCgnLi90b2tlbi90b2tlbicpLkluZm9NZXNzYWdlVG9rZW4pOiBib29sZWFuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZW1pdChldmVudDogJ2xhbmd1YWdlQ2hhbmdlJywgbGFuZ3VhZ2VOYW1lOiBzdHJpbmcpOiBib29sZWFuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZW1pdChldmVudDogJ3NlY3VyZScsIGNsZWFydGV4dDogaW1wb3J0KCd0bHMnKS5UTFNTb2NrZXQpOiBib29sZWFuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZW1pdChldmVudDogJ3Jlcm91dGluZycpOiBib29sZWFuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZW1pdChldmVudDogJ3Jlc2V0Q29ubmVjdGlvbicpOiBib29sZWFuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZW1pdChldmVudDogJ3JldHJ5Jyk6IGJvb2xlYW5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBlbWl0KGV2ZW50OiAncm9sbGJhY2tUcmFuc2FjdGlvbicpOiBib29sZWFuXG5cbiAgZW1pdChldmVudDogc3RyaW5nIHwgc3ltYm9sLCAuLi5hcmdzOiBhbnlbXSkge1xuICAgIHJldHVybiBzdXBlci5lbWl0KGV2ZW50LCAuLi5hcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zZXMgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBUaGUgW1tFdmVudF9lbmRdXSB3aWxsIGJlIGVtaXR0ZWQgb25jZSB0aGUgY29ubmVjdGlvbiBoYXMgYmVlbiBjbG9zZWQuXG4gICAqL1xuICBjbG9zZSgpIHtcbiAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgaW5pdGlhbGlzZUNvbm5lY3Rpb24oKSB7XG4gICAgY29uc3Qgc2lnbmFsID0gdGhpcy5jcmVhdGVDb25uZWN0VGltZXIoKTtcblxuICAgIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLnBvcnQpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RPblBvcnQodGhpcy5jb25maWcub3B0aW9ucy5wb3J0LCB0aGlzLmNvbmZpZy5vcHRpb25zLm11bHRpU3VibmV0RmFpbG92ZXIsIHNpZ25hbCwgdGhpcy5jb25maWcub3B0aW9ucy5jb25uZWN0b3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaW5zdGFuY2VMb29rdXAoe1xuICAgICAgICBzZXJ2ZXI6IHRoaXMuY29uZmlnLnNlcnZlcixcbiAgICAgICAgaW5zdGFuY2VOYW1lOiB0aGlzLmNvbmZpZy5vcHRpb25zLmluc3RhbmNlTmFtZSEsXG4gICAgICAgIHRpbWVvdXQ6IHRoaXMuY29uZmlnLm9wdGlvbnMuY29ubmVjdFRpbWVvdXQsXG4gICAgICAgIHNpZ25hbDogc2lnbmFsXG4gICAgICB9KS50aGVuKChwb3J0KSA9PiB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY29ubmVjdE9uUG9ydChwb3J0LCB0aGlzLmNvbmZpZy5vcHRpb25zLm11bHRpU3VibmV0RmFpbG92ZXIsIHNpZ25hbCwgdGhpcy5jb25maWcub3B0aW9ucy5jb25uZWN0b3IpO1xuICAgICAgICB9KTtcbiAgICAgIH0sIChlcnIpID0+IHtcbiAgICAgICAgdGhpcy5jbGVhckNvbm5lY3RUaW1lcigpO1xuXG4gICAgICAgIGlmIChzaWduYWwuYWJvcnRlZCkge1xuICAgICAgICAgIC8vIElnbm9yZSB0aGUgQWJvcnRFcnJvciBmb3Igbm93LCB0aGlzIGlzIHN0aWxsIGhhbmRsZWQgYnkgdGhlIGNvbm5lY3RUaW1lciBmaXJpbmdcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzLm5leHRUaWNrKCgpID0+IHtcbiAgICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnLCBuZXcgQ29ubmVjdGlvbkVycm9yKGVyci5tZXNzYWdlLCAnRUlOU1RMT09LVVAnLCB7IGNhdXNlOiBlcnIgfSkpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgY2xlYW51cENvbm5lY3Rpb24oY2xlYW51cFR5cGU6IHR5cGVvZiBDTEVBTlVQX1RZUEVba2V5b2YgdHlwZW9mIENMRUFOVVBfVFlQRV0pIHtcbiAgICBpZiAoIXRoaXMuY2xvc2VkKSB7XG4gICAgICB0aGlzLmNsZWFyQ29ubmVjdFRpbWVyKCk7XG4gICAgICB0aGlzLmNsZWFyUmVxdWVzdFRpbWVyKCk7XG4gICAgICB0aGlzLmNsZWFyUmV0cnlUaW1lcigpO1xuICAgICAgdGhpcy5jbG9zZUNvbm5lY3Rpb24oKTtcbiAgICAgIGlmIChjbGVhbnVwVHlwZSA9PT0gQ0xFQU5VUF9UWVBFLlJFRElSRUNUKSB7XG4gICAgICAgIHRoaXMuZW1pdCgncmVyb3V0aW5nJyk7XG4gICAgICB9IGVsc2UgaWYgKGNsZWFudXBUeXBlICE9PSBDTEVBTlVQX1RZUEUuUkVUUlkpIHtcbiAgICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5lbWl0KCdlbmQnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlcXVlc3QgPSB0aGlzLnJlcXVlc3Q7XG4gICAgICBpZiAocmVxdWVzdCkge1xuICAgICAgICBjb25zdCBlcnIgPSBuZXcgUmVxdWVzdEVycm9yKCdDb25uZWN0aW9uIGNsb3NlZCBiZWZvcmUgcmVxdWVzdCBjb21wbGV0ZWQuJywgJ0VDTE9TRScpO1xuICAgICAgICByZXF1ZXN0LmNhbGxiYWNrKGVycik7XG4gICAgICAgIHRoaXMucmVxdWVzdCA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgdGhpcy5jbG9zZWQgPSB0cnVlO1xuICAgICAgdGhpcy5sb2dpbkVycm9yID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgY3JlYXRlRGVidWcoKSB7XG4gICAgY29uc3QgZGVidWcgPSBuZXcgRGVidWcodGhpcy5jb25maWcub3B0aW9ucy5kZWJ1Zyk7XG4gICAgZGVidWcub24oJ2RlYnVnJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBtZXNzYWdlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVidWc7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGNyZWF0ZVRva2VuU3RyZWFtUGFyc2VyKG1lc3NhZ2U6IE1lc3NhZ2UsIGhhbmRsZXI6IFRva2VuSGFuZGxlcikge1xuICAgIHJldHVybiBuZXcgVG9rZW5TdHJlYW1QYXJzZXIobWVzc2FnZSwgdGhpcy5kZWJ1ZywgaGFuZGxlciwgdGhpcy5jb25maWcub3B0aW9ucyk7XG4gIH1cblxuICBzb2NrZXRIYW5kbGluZ0ZvclNlbmRQcmVMb2dpbihzb2NrZXQ6IG5ldC5Tb2NrZXQpIHtcbiAgICBzb2NrZXQub24oJ2Vycm9yJywgKGVycm9yKSA9PiB7IHRoaXMuc29ja2V0RXJyb3IoZXJyb3IpOyB9KTtcbiAgICBzb2NrZXQub24oJ2Nsb3NlJywgKCkgPT4geyB0aGlzLnNvY2tldENsb3NlKCk7IH0pO1xuICAgIHNvY2tldC5vbignZW5kJywgKCkgPT4geyB0aGlzLnNvY2tldEVuZCgpOyB9KTtcbiAgICBzb2NrZXQuc2V0S2VlcEFsaXZlKHRydWUsIEtFRVBfQUxJVkVfSU5JVElBTF9ERUxBWSk7XG5cbiAgICB0aGlzLm1lc3NhZ2VJbyA9IG5ldyBNZXNzYWdlSU8oc29ja2V0LCB0aGlzLmNvbmZpZy5vcHRpb25zLnBhY2tldFNpemUsIHRoaXMuZGVidWcpO1xuICAgIHRoaXMubWVzc2FnZUlvLm9uKCdzZWN1cmUnLCAoY2xlYXJ0ZXh0KSA9PiB7IHRoaXMuZW1pdCgnc2VjdXJlJywgY2xlYXJ0ZXh0KTsgfSk7XG5cbiAgICB0aGlzLnNvY2tldCA9IHNvY2tldDtcblxuICAgIHRoaXMuY2xvc2VkID0gZmFsc2U7XG4gICAgdGhpcy5kZWJ1Zy5sb2coJ2Nvbm5lY3RlZCB0byAnICsgdGhpcy5jb25maWcuc2VydmVyICsgJzonICsgdGhpcy5jb25maWcub3B0aW9ucy5wb3J0KTtcblxuICAgIHRoaXMuc2VuZFByZUxvZ2luKCk7XG4gICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5TRU5UX1BSRUxPR0lOKTtcbiAgfVxuXG4gIHdyYXBXaXRoVGxzKHNvY2tldDogbmV0LlNvY2tldCwgc2lnbmFsOiBBYm9ydFNpZ25hbCk6IFByb21pc2U8dGxzLlRMU1NvY2tldD4ge1xuICAgIHNpZ25hbC50aHJvd0lmQWJvcnRlZCgpO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHNlY3VyZUNvbnRleHQgPSB0bHMuY3JlYXRlU2VjdXJlQ29udGV4dCh0aGlzLnNlY3VyZUNvbnRleHRPcHRpb25zKTtcbiAgICAgIC8vIElmIGNvbm5lY3QgdG8gYW4gaXAgYWRkcmVzcyBkaXJlY3RseSxcbiAgICAgIC8vIG5lZWQgdG8gc2V0IHRoZSBzZXJ2ZXJuYW1lIHRvIGFuIGVtcHR5IHN0cmluZ1xuICAgICAgLy8gaWYgdGhlIHVzZXIgaGFzIG5vdCBnaXZlbiBhIHNlcnZlcm5hbWUgZXhwbGljaXRseVxuICAgICAgY29uc3Qgc2VydmVyTmFtZSA9ICFuZXQuaXNJUCh0aGlzLmNvbmZpZy5zZXJ2ZXIpID8gdGhpcy5jb25maWcuc2VydmVyIDogJyc7XG4gICAgICBjb25zdCBlbmNyeXB0T3B0aW9ucyA9IHtcbiAgICAgICAgaG9zdDogdGhpcy5jb25maWcuc2VydmVyLFxuICAgICAgICBzb2NrZXQ6IHNvY2tldCxcbiAgICAgICAgQUxQTlByb3RvY29sczogWyd0ZHMvOC4wJ10sXG4gICAgICAgIHNlY3VyZUNvbnRleHQ6IHNlY3VyZUNvbnRleHQsXG4gICAgICAgIHNlcnZlcm5hbWU6IHRoaXMuY29uZmlnLm9wdGlvbnMuc2VydmVyTmFtZSA/IHRoaXMuY29uZmlnLm9wdGlvbnMuc2VydmVyTmFtZSA6IHNlcnZlck5hbWUsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBlbmNyeXB0c29ja2V0ID0gdGxzLmNvbm5lY3QoZW5jcnlwdE9wdGlvbnMpO1xuXG4gICAgICBjb25zdCBvbkFib3J0ID0gKCkgPT4ge1xuICAgICAgICBlbmNyeXB0c29ja2V0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uRXJyb3IpO1xuICAgICAgICBlbmNyeXB0c29ja2V0LnJlbW92ZUxpc3RlbmVyKCdjb25uZWN0Jywgb25Db25uZWN0KTtcblxuICAgICAgICBlbmNyeXB0c29ja2V0LmRlc3Ryb3koKTtcblxuICAgICAgICByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBvbkVycm9yID0gKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Fib3J0Jywgb25BYm9ydCk7XG5cbiAgICAgICAgZW5jcnlwdHNvY2tldC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbkVycm9yKTtcbiAgICAgICAgZW5jcnlwdHNvY2tldC5yZW1vdmVMaXN0ZW5lcignY29ubmVjdCcsIG9uQ29ubmVjdCk7XG5cbiAgICAgICAgZW5jcnlwdHNvY2tldC5kZXN0cm95KCk7XG5cbiAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBvbkNvbm5lY3QgPSAoKSA9PiB7XG4gICAgICAgIHNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKCdhYm9ydCcsIG9uQWJvcnQpO1xuXG4gICAgICAgIGVuY3J5cHRzb2NrZXQucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25FcnJvcik7XG4gICAgICAgIGVuY3J5cHRzb2NrZXQucmVtb3ZlTGlzdGVuZXIoJ2Nvbm5lY3QnLCBvbkNvbm5lY3QpO1xuXG4gICAgICAgIHJlc29sdmUoZW5jcnlwdHNvY2tldCk7XG4gICAgICB9O1xuXG4gICAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBvbkFib3J0LCB7IG9uY2U6IHRydWUgfSk7XG5cbiAgICAgIGVuY3J5cHRzb2NrZXQub24oJ2Vycm9yJywgb25FcnJvcik7XG4gICAgICBlbmNyeXB0c29ja2V0Lm9uKCdzZWN1cmVDb25uZWN0Jywgb25Db25uZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbm5lY3RPblBvcnQocG9ydDogbnVtYmVyLCBtdWx0aVN1Ym5ldEZhaWxvdmVyOiBib29sZWFuLCBzaWduYWw6IEFib3J0U2lnbmFsLCBjdXN0b21Db25uZWN0b3I/OiAoKSA9PiBQcm9taXNlPG5ldC5Tb2NrZXQ+KSB7XG4gICAgY29uc3QgY29ubmVjdE9wdHMgPSB7XG4gICAgICBob3N0OiB0aGlzLnJvdXRpbmdEYXRhID8gdGhpcy5yb3V0aW5nRGF0YS5zZXJ2ZXIgOiB0aGlzLmNvbmZpZy5zZXJ2ZXIsXG4gICAgICBwb3J0OiB0aGlzLnJvdXRpbmdEYXRhID8gdGhpcy5yb3V0aW5nRGF0YS5wb3J0IDogcG9ydCxcbiAgICAgIGxvY2FsQWRkcmVzczogdGhpcy5jb25maWcub3B0aW9ucy5sb2NhbEFkZHJlc3NcbiAgICB9O1xuXG4gICAgY29uc3QgY29ubmVjdCA9IGN1c3RvbUNvbm5lY3RvciB8fCAobXVsdGlTdWJuZXRGYWlsb3ZlciA/IGNvbm5lY3RJblBhcmFsbGVsIDogY29ubmVjdEluU2VxdWVuY2UpO1xuXG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIGxldCBzb2NrZXQgPSBhd2FpdCBjb25uZWN0KGNvbm5lY3RPcHRzLCBkbnMubG9va3VwLCBzaWduYWwpO1xuXG4gICAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy5lbmNyeXB0ID09PSAnc3RyaWN0Jykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIFdyYXAgdGhlIHNvY2tldCB3aXRoIFRMUyBmb3IgVERTIDguMFxuICAgICAgICAgIHNvY2tldCA9IGF3YWl0IHRoaXMud3JhcFdpdGhUbHMoc29ja2V0LCBzaWduYWwpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBzb2NrZXQuZW5kKCk7XG5cbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5zb2NrZXRIYW5kbGluZ0ZvclNlbmRQcmVMb2dpbihzb2NrZXQpO1xuICAgIH0pKCkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgdGhpcy5jbGVhckNvbm5lY3RUaW1lcigpO1xuXG4gICAgICBpZiAoc2lnbmFsLmFib3J0ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBwcm9jZXNzLm5leHRUaWNrKCgpID0+IHsgdGhpcy5zb2NrZXRFcnJvcihlcnIpOyB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgY2xvc2VDb25uZWN0aW9uKCkge1xuICAgIGlmICh0aGlzLnNvY2tldCkge1xuICAgICAgdGhpcy5zb2NrZXQuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgY3JlYXRlQ29ubmVjdFRpbWVyKCkge1xuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgdGhpcy5jb25uZWN0VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgIHRoaXMuY29ubmVjdFRpbWVvdXQoKTtcbiAgICB9LCB0aGlzLmNvbmZpZy5vcHRpb25zLmNvbm5lY3RUaW1lb3V0KTtcbiAgICByZXR1cm4gY29udHJvbGxlci5zaWduYWw7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGNyZWF0ZUNhbmNlbFRpbWVyKCkge1xuICAgIHRoaXMuY2xlYXJDYW5jZWxUaW1lcigpO1xuICAgIGNvbnN0IHRpbWVvdXQgPSB0aGlzLmNvbmZpZy5vcHRpb25zLmNhbmNlbFRpbWVvdXQ7XG4gICAgaWYgKHRpbWVvdXQgPiAwKSB7XG4gICAgICB0aGlzLmNhbmNlbFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuY2FuY2VsVGltZW91dCgpO1xuICAgICAgfSwgdGltZW91dCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBjcmVhdGVSZXF1ZXN0VGltZXIoKSB7XG4gICAgdGhpcy5jbGVhclJlcXVlc3RUaW1lcigpOyAvLyByZWxlYXNlIG9sZCB0aW1lciwganVzdCB0byBiZSBzYWZlXG4gICAgY29uc3QgcmVxdWVzdCA9IHRoaXMucmVxdWVzdCBhcyBSZXF1ZXN0O1xuICAgIGNvbnN0IHRpbWVvdXQgPSAocmVxdWVzdC50aW1lb3V0ICE9PSB1bmRlZmluZWQpID8gcmVxdWVzdC50aW1lb3V0IDogdGhpcy5jb25maWcub3B0aW9ucy5yZXF1ZXN0VGltZW91dDtcbiAgICBpZiAodGltZW91dCkge1xuICAgICAgdGhpcy5yZXF1ZXN0VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5yZXF1ZXN0VGltZW91dCgpO1xuICAgICAgfSwgdGltZW91dCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBjcmVhdGVSZXRyeVRpbWVyKCkge1xuICAgIHRoaXMuY2xlYXJSZXRyeVRpbWVyKCk7XG4gICAgdGhpcy5yZXRyeVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnJldHJ5VGltZW91dCgpO1xuICAgIH0sIHRoaXMuY29uZmlnLm9wdGlvbnMuY29ubmVjdGlvblJldHJ5SW50ZXJ2YWwpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBjb25uZWN0VGltZW91dCgpIHtcbiAgICBjb25zdCBob3N0UG9zdGZpeCA9IHRoaXMuY29uZmlnLm9wdGlvbnMucG9ydCA/IGA6JHt0aGlzLmNvbmZpZy5vcHRpb25zLnBvcnR9YCA6IGBcXFxcJHt0aGlzLmNvbmZpZy5vcHRpb25zLmluc3RhbmNlTmFtZX1gO1xuICAgIC8vIElmIHdlIGhhdmUgcm91dGluZyBkYXRhIHN0b3JlZCwgdGhpcyBjb25uZWN0aW9uIGhhcyBiZWVuIHJlZGlyZWN0ZWRcbiAgICBjb25zdCBzZXJ2ZXIgPSB0aGlzLnJvdXRpbmdEYXRhID8gdGhpcy5yb3V0aW5nRGF0YS5zZXJ2ZXIgOiB0aGlzLmNvbmZpZy5zZXJ2ZXI7XG4gICAgY29uc3QgcG9ydCA9IHRoaXMucm91dGluZ0RhdGEgPyBgOiR7dGhpcy5yb3V0aW5nRGF0YS5wb3J0fWAgOiBob3N0UG9zdGZpeDtcbiAgICAvLyBHcmFiIHRoZSB0YXJnZXQgaG9zdCBmcm9tIHRoZSBjb25uZWN0aW9uIGNvbmZpZ3VyYXRpb24sIGFuZCBmcm9tIGEgcmVkaXJlY3QgbWVzc2FnZVxuICAgIC8vIG90aGVyd2lzZSwgbGVhdmUgdGhlIG1lc3NhZ2UgZW1wdHkuXG4gICAgY29uc3Qgcm91dGluZ01lc3NhZ2UgPSB0aGlzLnJvdXRpbmdEYXRhID8gYCAocmVkaXJlY3RlZCBmcm9tICR7dGhpcy5jb25maWcuc2VydmVyfSR7aG9zdFBvc3RmaXh9KWAgOiAnJztcbiAgICBjb25zdCBtZXNzYWdlID0gYEZhaWxlZCB0byBjb25uZWN0IHRvICR7c2VydmVyfSR7cG9ydH0ke3JvdXRpbmdNZXNzYWdlfSBpbiAke3RoaXMuY29uZmlnLm9wdGlvbnMuY29ubmVjdFRpbWVvdXR9bXNgO1xuICAgIHRoaXMuZGVidWcubG9nKG1lc3NhZ2UpO1xuICAgIHRoaXMuZW1pdCgnY29ubmVjdCcsIG5ldyBDb25uZWN0aW9uRXJyb3IobWVzc2FnZSwgJ0VUSU1FT1VUJykpO1xuICAgIHRoaXMuY29ubmVjdFRpbWVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCgnY29ubmVjdFRpbWVvdXQnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgY2FuY2VsVGltZW91dCgpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYEZhaWxlZCB0byBjYW5jZWwgcmVxdWVzdCBpbiAke3RoaXMuY29uZmlnLm9wdGlvbnMuY2FuY2VsVGltZW91dH1tc2A7XG4gICAgdGhpcy5kZWJ1Zy5sb2cobWVzc2FnZSk7XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KCdzb2NrZXRFcnJvcicsIG5ldyBDb25uZWN0aW9uRXJyb3IobWVzc2FnZSwgJ0VUSU1FT1VUJykpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICByZXF1ZXN0VGltZW91dCgpIHtcbiAgICB0aGlzLnJlcXVlc3RUaW1lciA9IHVuZGVmaW5lZDtcbiAgICBjb25zdCByZXF1ZXN0ID0gdGhpcy5yZXF1ZXN0ITtcbiAgICByZXF1ZXN0LmNhbmNlbCgpO1xuICAgIGNvbnN0IHRpbWVvdXQgPSAocmVxdWVzdC50aW1lb3V0ICE9PSB1bmRlZmluZWQpID8gcmVxdWVzdC50aW1lb3V0IDogdGhpcy5jb25maWcub3B0aW9ucy5yZXF1ZXN0VGltZW91dDtcbiAgICBjb25zdCBtZXNzYWdlID0gJ1RpbWVvdXQ6IFJlcXVlc3QgZmFpbGVkIHRvIGNvbXBsZXRlIGluICcgKyB0aW1lb3V0ICsgJ21zJztcbiAgICByZXF1ZXN0LmVycm9yID0gbmV3IFJlcXVlc3RFcnJvcihtZXNzYWdlLCAnRVRJTUVPVVQnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcmV0cnlUaW1lb3V0KCkge1xuICAgIHRoaXMucmV0cnlUaW1lciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmVtaXQoJ3JldHJ5Jyk7XG4gICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5DT05ORUNUSU5HKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgY2xlYXJDb25uZWN0VGltZXIoKSB7XG4gICAgaWYgKHRoaXMuY29ubmVjdFRpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5jb25uZWN0VGltZXIpO1xuICAgICAgdGhpcy5jb25uZWN0VGltZXIgPSB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBjbGVhckNhbmNlbFRpbWVyKCkge1xuICAgIGlmICh0aGlzLmNhbmNlbFRpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5jYW5jZWxUaW1lcik7XG4gICAgICB0aGlzLmNhbmNlbFRpbWVyID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgY2xlYXJSZXF1ZXN0VGltZXIoKSB7XG4gICAgaWYgKHRoaXMucmVxdWVzdFRpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5yZXF1ZXN0VGltZXIpO1xuICAgICAgdGhpcy5yZXF1ZXN0VGltZXIgPSB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBjbGVhclJldHJ5VGltZXIoKSB7XG4gICAgaWYgKHRoaXMucmV0cnlUaW1lcikge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucmV0cnlUaW1lcik7XG4gICAgICB0aGlzLnJldHJ5VGltZXIgPSB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICB0cmFuc2l0aW9uVG8obmV3U3RhdGU6IFN0YXRlKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IG5ld1N0YXRlKSB7XG4gICAgICB0aGlzLmRlYnVnLmxvZygnU3RhdGUgaXMgYWxyZWFkeSAnICsgbmV3U3RhdGUubmFtZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc3RhdGUgJiYgdGhpcy5zdGF0ZS5leGl0KSB7XG4gICAgICB0aGlzLnN0YXRlLmV4aXQuY2FsbCh0aGlzLCBuZXdTdGF0ZSk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWJ1Zy5sb2coJ1N0YXRlIGNoYW5nZTogJyArICh0aGlzLnN0YXRlID8gdGhpcy5zdGF0ZS5uYW1lIDogJ3VuZGVmaW5lZCcpICsgJyAtPiAnICsgbmV3U3RhdGUubmFtZSk7XG4gICAgdGhpcy5zdGF0ZSA9IG5ld1N0YXRlO1xuXG4gICAgaWYgKHRoaXMuc3RhdGUuZW50ZXIpIHtcbiAgICAgIHRoaXMuc3RhdGUuZW50ZXIuYXBwbHkodGhpcyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBnZXRFdmVudEhhbmRsZXI8VCBleHRlbmRzIGtleW9mIFN0YXRlWydldmVudHMnXT4oZXZlbnROYW1lOiBUKTogTm9uTnVsbGFibGU8U3RhdGVbJ2V2ZW50cyddW1RdPiB7XG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMuc3RhdGUuZXZlbnRzW2V2ZW50TmFtZV07XG5cbiAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gZXZlbnQgJyR7ZXZlbnROYW1lfScgaW4gc3RhdGUgJyR7dGhpcy5zdGF0ZS5uYW1lfSdgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlciE7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGRpc3BhdGNoRXZlbnQ8VCBleHRlbmRzIGtleW9mIFN0YXRlWydldmVudHMnXT4oZXZlbnROYW1lOiBULCAuLi5hcmdzOiBQYXJhbWV0ZXJzPE5vbk51bGxhYmxlPFN0YXRlWydldmVudHMnXVtUXT4+KSB7XG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMuc3RhdGUuZXZlbnRzW2V2ZW50TmFtZV0gYXMgKCh0aGlzOiBDb25uZWN0aW9uLCAuLi5hcmdzOiBhbnlbXSkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG4gICAgaWYgKGhhbmRsZXIpIHtcbiAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoYE5vIGV2ZW50ICcke2V2ZW50TmFtZX0nIGluIHN0YXRlICcke3RoaXMuc3RhdGUubmFtZX0nYCkpO1xuICAgICAgdGhpcy5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc29ja2V0RXJyb3IoZXJyb3I6IEVycm9yKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IHRoaXMuU1RBVEUuQ09OTkVDVElORyB8fCB0aGlzLnN0YXRlID09PSB0aGlzLlNUQVRFLlNFTlRfVExTU1NMTkVHT1RJQVRJT04pIHtcbiAgICAgIGNvbnN0IGhvc3RQb3N0Zml4ID0gdGhpcy5jb25maWcub3B0aW9ucy5wb3J0ID8gYDoke3RoaXMuY29uZmlnLm9wdGlvbnMucG9ydH1gIDogYFxcXFwke3RoaXMuY29uZmlnLm9wdGlvbnMuaW5zdGFuY2VOYW1lfWA7XG4gICAgICAvLyBJZiB3ZSBoYXZlIHJvdXRpbmcgZGF0YSBzdG9yZWQsIHRoaXMgY29ubmVjdGlvbiBoYXMgYmVlbiByZWRpcmVjdGVkXG4gICAgICBjb25zdCBzZXJ2ZXIgPSB0aGlzLnJvdXRpbmdEYXRhID8gdGhpcy5yb3V0aW5nRGF0YS5zZXJ2ZXIgOiB0aGlzLmNvbmZpZy5zZXJ2ZXI7XG4gICAgICBjb25zdCBwb3J0ID0gdGhpcy5yb3V0aW5nRGF0YSA/IGA6JHt0aGlzLnJvdXRpbmdEYXRhLnBvcnR9YCA6IGhvc3RQb3N0Zml4O1xuICAgICAgLy8gR3JhYiB0aGUgdGFyZ2V0IGhvc3QgZnJvbSB0aGUgY29ubmVjdGlvbiBjb25maWd1cmF0aW9uLCBhbmQgZnJvbSBhIHJlZGlyZWN0IG1lc3NhZ2VcbiAgICAgIC8vIG90aGVyd2lzZSwgbGVhdmUgdGhlIG1lc3NhZ2UgZW1wdHkuXG4gICAgICBjb25zdCByb3V0aW5nTWVzc2FnZSA9IHRoaXMucm91dGluZ0RhdGEgPyBgIChyZWRpcmVjdGVkIGZyb20gJHt0aGlzLmNvbmZpZy5zZXJ2ZXJ9JHtob3N0UG9zdGZpeH0pYCA6ICcnO1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGBGYWlsZWQgdG8gY29ubmVjdCB0byAke3NlcnZlcn0ke3BvcnR9JHtyb3V0aW5nTWVzc2FnZX0gLSAke2Vycm9yLm1lc3NhZ2V9YDtcbiAgICAgIHRoaXMuZGVidWcubG9nKG1lc3NhZ2UpO1xuICAgICAgdGhpcy5lbWl0KCdjb25uZWN0JywgbmV3IENvbm5lY3Rpb25FcnJvcihtZXNzYWdlLCAnRVNPQ0tFVCcsIHsgY2F1c2U6IGVycm9yIH0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGBDb25uZWN0aW9uIGxvc3QgLSAke2Vycm9yLm1lc3NhZ2V9YDtcbiAgICAgIHRoaXMuZGVidWcubG9nKG1lc3NhZ2UpO1xuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBDb25uZWN0aW9uRXJyb3IobWVzc2FnZSwgJ0VTT0NLRVQnLCB7IGNhdXNlOiBlcnJvciB9KSk7XG4gICAgfVxuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCgnc29ja2V0RXJyb3InLCBlcnJvcik7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHNvY2tldEVuZCgpIHtcbiAgICB0aGlzLmRlYnVnLmxvZygnc29ja2V0IGVuZGVkJyk7XG4gICAgaWYgKHRoaXMuc3RhdGUgIT09IHRoaXMuU1RBVEUuRklOQUwpIHtcbiAgICAgIGNvbnN0IGVycm9yOiBFcnJvcldpdGhDb2RlID0gbmV3IEVycm9yKCdzb2NrZXQgaGFuZyB1cCcpO1xuICAgICAgZXJyb3IuY29kZSA9ICdFQ09OTlJFU0VUJztcbiAgICAgIHRoaXMuc29ja2V0RXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc29ja2V0Q2xvc2UoKSB7XG4gICAgdGhpcy5kZWJ1Zy5sb2coJ2Nvbm5lY3Rpb24gdG8gJyArIHRoaXMuY29uZmlnLnNlcnZlciArICc6JyArIHRoaXMuY29uZmlnLm9wdGlvbnMucG9ydCArICcgY2xvc2VkJyk7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IHRoaXMuU1RBVEUuUkVST1VUSU5HKSB7XG4gICAgICB0aGlzLmRlYnVnLmxvZygnUmVyb3V0aW5nIHRvICcgKyB0aGlzLnJvdXRpbmdEYXRhIS5zZXJ2ZXIgKyAnOicgKyB0aGlzLnJvdXRpbmdEYXRhIS5wb3J0KTtcblxuICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KCdyZWNvbm5lY3QnKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IHRoaXMuU1RBVEUuVFJBTlNJRU5UX0ZBSUxVUkVfUkVUUlkpIHtcbiAgICAgIGNvbnN0IHNlcnZlciA9IHRoaXMucm91dGluZ0RhdGEgPyB0aGlzLnJvdXRpbmdEYXRhLnNlcnZlciA6IHRoaXMuY29uZmlnLnNlcnZlcjtcbiAgICAgIGNvbnN0IHBvcnQgPSB0aGlzLnJvdXRpbmdEYXRhID8gdGhpcy5yb3V0aW5nRGF0YS5wb3J0IDogdGhpcy5jb25maWcub3B0aW9ucy5wb3J0O1xuICAgICAgdGhpcy5kZWJ1Zy5sb2coJ1JldHJ5IGFmdGVyIHRyYW5zaWVudCBmYWlsdXJlIGNvbm5lY3RpbmcgdG8gJyArIHNlcnZlciArICc6JyArIHBvcnQpO1xuXG4gICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoJ3JldHJ5Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuRklOQUwpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc2VuZFByZUxvZ2luKCkge1xuICAgIGNvbnN0IFssIG1ham9yLCBtaW5vciwgYnVpbGRdID0gL14oXFxkKylcXC4oXFxkKylcXC4oXFxkKykvLmV4ZWModmVyc2lvbikgPz8gWycwLjAuMCcsICcwJywgJzAnLCAnMCddO1xuICAgIGNvbnN0IHBheWxvYWQgPSBuZXcgUHJlbG9naW5QYXlsb2FkKHtcbiAgICAgIC8vIElmIGVuY3J5cHQgc2V0dGluZyBpcyBzZXQgdG8gJ3N0cmljdCcsIHRoZW4gd2Ugc2hvdWxkIGhhdmUgYWxyZWFkeSBkb25lIHRoZSBlbmNyeXB0aW9uIGJlZm9yZSBjYWxsaW5nXG4gICAgICAvLyB0aGlzIGZ1bmN0aW9uLiBUaGVyZWZvcmUsIHRoZSBlbmNyeXB0IHdpbGwgYmUgc2V0IHRvIGZhbHNlIGhlcmUuXG4gICAgICAvLyBPdGhlcndpc2UsIHdlIHdpbGwgc2V0IGVuY3J5cHQgaGVyZSBiYXNlZCBvbiB0aGUgZW5jcnlwdCBCb29sZWFuIHZhbHVlIGZyb20gdGhlIGNvbmZpZ3VyYXRpb24uXG4gICAgICBlbmNyeXB0OiB0eXBlb2YgdGhpcy5jb25maWcub3B0aW9ucy5lbmNyeXB0ID09PSAnYm9vbGVhbicgJiYgdGhpcy5jb25maWcub3B0aW9ucy5lbmNyeXB0LFxuICAgICAgdmVyc2lvbjogeyBtYWpvcjogTnVtYmVyKG1ham9yKSwgbWlub3I6IE51bWJlcihtaW5vciksIGJ1aWxkOiBOdW1iZXIoYnVpbGQpLCBzdWJidWlsZDogMCB9XG4gICAgfSk7XG5cbiAgICB0aGlzLm1lc3NhZ2VJby5zZW5kTWVzc2FnZShUWVBFLlBSRUxPR0lOLCBwYXlsb2FkLmRhdGEpO1xuICAgIHRoaXMuZGVidWcucGF5bG9hZChmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBwYXlsb2FkLnRvU3RyaW5nKCcgICcpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzZW5kTG9naW43UGFja2V0KCkge1xuICAgIGNvbnN0IHBheWxvYWQgPSBuZXcgTG9naW43UGF5bG9hZCh7XG4gICAgICB0ZHNWZXJzaW9uOiB2ZXJzaW9uc1t0aGlzLmNvbmZpZy5vcHRpb25zLnRkc1ZlcnNpb25dLFxuICAgICAgcGFja2V0U2l6ZTogdGhpcy5jb25maWcub3B0aW9ucy5wYWNrZXRTaXplLFxuICAgICAgY2xpZW50UHJvZ1ZlcjogMCxcbiAgICAgIGNsaWVudFBpZDogcHJvY2Vzcy5waWQsXG4gICAgICBjb25uZWN0aW9uSWQ6IDAsXG4gICAgICBjbGllbnRUaW1lWm9uZTogbmV3IERhdGUoKS5nZXRUaW1lem9uZU9mZnNldCgpLFxuICAgICAgY2xpZW50TGNpZDogMHgwMDAwMDQwOVxuICAgIH0pO1xuXG4gICAgY29uc3QgeyBhdXRoZW50aWNhdGlvbiB9ID0gdGhpcy5jb25maWc7XG4gICAgc3dpdGNoIChhdXRoZW50aWNhdGlvbi50eXBlKSB7XG4gICAgICBjYXNlICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LXBhc3N3b3JkJzpcbiAgICAgICAgcGF5bG9hZC5mZWRBdXRoID0ge1xuICAgICAgICAgIHR5cGU6ICdBREFMJyxcbiAgICAgICAgICBlY2hvOiB0aGlzLmZlZEF1dGhSZXF1aXJlZCxcbiAgICAgICAgICB3b3JrZmxvdzogJ2RlZmF1bHQnXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LWFjY2Vzcy10b2tlbic6XG4gICAgICAgIHBheWxvYWQuZmVkQXV0aCA9IHtcbiAgICAgICAgICB0eXBlOiAnU0VDVVJJVFlUT0tFTicsXG4gICAgICAgICAgZWNobzogdGhpcy5mZWRBdXRoUmVxdWlyZWQsXG4gICAgICAgICAgZmVkQXV0aFRva2VuOiBhdXRoZW50aWNhdGlvbi5vcHRpb25zLnRva2VuXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICd0b2tlbi1jcmVkZW50aWFsJzpcbiAgICAgIGNhc2UgJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktbXNpLXZtJzpcbiAgICAgIGNhc2UgJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktZGVmYXVsdCc6XG4gICAgICBjYXNlICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LW1zaS1hcHAtc2VydmljZSc6XG4gICAgICBjYXNlICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LXNlcnZpY2UtcHJpbmNpcGFsLXNlY3JldCc6XG4gICAgICAgIHBheWxvYWQuZmVkQXV0aCA9IHtcbiAgICAgICAgICB0eXBlOiAnQURBTCcsXG4gICAgICAgICAgZWNobzogdGhpcy5mZWRBdXRoUmVxdWlyZWQsXG4gICAgICAgICAgd29ya2Zsb3c6ICdpbnRlZ3JhdGVkJ1xuICAgICAgICB9O1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnbnRsbSc6XG4gICAgICAgIHBheWxvYWQuc3NwaSA9IGNyZWF0ZU5UTE1SZXF1ZXN0KHsgZG9tYWluOiBhdXRoZW50aWNhdGlvbi5vcHRpb25zLmRvbWFpbiB9KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHBheWxvYWQudXNlck5hbWUgPSBhdXRoZW50aWNhdGlvbi5vcHRpb25zLnVzZXJOYW1lO1xuICAgICAgICBwYXlsb2FkLnBhc3N3b3JkID0gYXV0aGVudGljYXRpb24ub3B0aW9ucy5wYXNzd29yZDtcbiAgICB9XG5cbiAgICBwYXlsb2FkLmhvc3RuYW1lID0gdGhpcy5jb25maWcub3B0aW9ucy53b3Jrc3RhdGlvbklkIHx8IG9zLmhvc3RuYW1lKCk7XG4gICAgcGF5bG9hZC5zZXJ2ZXJOYW1lID0gdGhpcy5yb3V0aW5nRGF0YSA/IHRoaXMucm91dGluZ0RhdGEuc2VydmVyIDogdGhpcy5jb25maWcuc2VydmVyO1xuICAgIHBheWxvYWQuYXBwTmFtZSA9IHRoaXMuY29uZmlnLm9wdGlvbnMuYXBwTmFtZSB8fCAnVGVkaW91cyc7XG4gICAgcGF5bG9hZC5saWJyYXJ5TmFtZSA9IGxpYnJhcnlOYW1lO1xuICAgIHBheWxvYWQubGFuZ3VhZ2UgPSB0aGlzLmNvbmZpZy5vcHRpb25zLmxhbmd1YWdlO1xuICAgIHBheWxvYWQuZGF0YWJhc2UgPSB0aGlzLmNvbmZpZy5vcHRpb25zLmRhdGFiYXNlO1xuICAgIHBheWxvYWQuY2xpZW50SWQgPSBCdWZmZXIuZnJvbShbMSwgMiwgMywgNCwgNSwgNl0pO1xuXG4gICAgcGF5bG9hZC5yZWFkT25seUludGVudCA9IHRoaXMuY29uZmlnLm9wdGlvbnMucmVhZE9ubHlJbnRlbnQ7XG4gICAgcGF5bG9hZC5pbml0RGJGYXRhbCA9ICF0aGlzLmNvbmZpZy5vcHRpb25zLmZhbGxiYWNrVG9EZWZhdWx0RGI7XG5cbiAgICB0aGlzLnJvdXRpbmdEYXRhID0gdW5kZWZpbmVkO1xuICAgIHRoaXMubWVzc2FnZUlvLnNlbmRNZXNzYWdlKFRZUEUuTE9HSU43LCBwYXlsb2FkLnRvQnVmZmVyKCkpO1xuXG4gICAgdGhpcy5kZWJ1Zy5wYXlsb2FkKGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHBheWxvYWQudG9TdHJpbmcoJyAgJyk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHNlbmRGZWRBdXRoVG9rZW5NZXNzYWdlKHRva2VuOiBzdHJpbmcpIHtcbiAgICBjb25zdCBhY2Nlc3NUb2tlbkxlbiA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHRva2VuLCAndWNzMicpO1xuICAgIGNvbnN0IGRhdGEgPSBCdWZmZXIuYWxsb2MoOCArIGFjY2Vzc1Rva2VuTGVuKTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBvZmZzZXQgPSBkYXRhLndyaXRlVUludDMyTEUoYWNjZXNzVG9rZW5MZW4gKyA0LCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IGRhdGEud3JpdGVVSW50MzJMRShhY2Nlc3NUb2tlbkxlbiwgb2Zmc2V0KTtcbiAgICBkYXRhLndyaXRlKHRva2VuLCBvZmZzZXQsICd1Y3MyJyk7XG4gICAgdGhpcy5tZXNzYWdlSW8uc2VuZE1lc3NhZ2UoVFlQRS5GRURBVVRIX1RPS0VOLCBkYXRhKTtcbiAgICAvLyBzZW50IHRoZSBmZWRBdXRoIHRva2VuIG1lc3NhZ2UsIHRoZSByZXN0IGlzIHNpbWlsYXIgdG8gc3RhbmRhcmQgbG9naW4gN1xuICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuU0VOVF9MT0dJTjdfV0lUSF9TVEFOREFSRF9MT0dJTik7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHNlbmRJbml0aWFsU3FsKCkge1xuICAgIGNvbnN0IHBheWxvYWQgPSBuZXcgU3FsQmF0Y2hQYXlsb2FkKHRoaXMuZ2V0SW5pdGlhbFNxbCgpLCB0aGlzLmN1cnJlbnRUcmFuc2FjdGlvbkRlc2NyaXB0b3IoKSwgdGhpcy5jb25maWcub3B0aW9ucyk7XG5cbiAgICBjb25zdCBtZXNzYWdlID0gbmV3IE1lc3NhZ2UoeyB0eXBlOiBUWVBFLlNRTF9CQVRDSCB9KTtcbiAgICB0aGlzLm1lc3NhZ2VJby5vdXRnb2luZ01lc3NhZ2VTdHJlYW0ud3JpdGUobWVzc2FnZSk7XG4gICAgUmVhZGFibGUuZnJvbShwYXlsb2FkKS5waXBlKG1lc3NhZ2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBnZXRJbml0aWFsU3FsKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBbXTtcblxuICAgIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lOdWxsID09PSB0cnVlKSB7XG4gICAgICBvcHRpb25zLnB1c2goJ3NldCBhbnNpX251bGxzIG9uJyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lOdWxsID09PSBmYWxzZSkge1xuICAgICAgb3B0aW9ucy5wdXNoKCdzZXQgYW5zaV9udWxscyBvZmYnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVBbnNpTnVsbERlZmF1bHQgPT09IHRydWUpIHtcbiAgICAgIG9wdGlvbnMucHVzaCgnc2V0IGFuc2lfbnVsbF9kZmx0X29uIG9uJyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lOdWxsRGVmYXVsdCA9PT0gZmFsc2UpIHtcbiAgICAgIG9wdGlvbnMucHVzaCgnc2V0IGFuc2lfbnVsbF9kZmx0X29uIG9mZicpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lQYWRkaW5nID09PSB0cnVlKSB7XG4gICAgICBvcHRpb25zLnB1c2goJ3NldCBhbnNpX3BhZGRpbmcgb24nKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaVBhZGRpbmcgPT09IGZhbHNlKSB7XG4gICAgICBvcHRpb25zLnB1c2goJ3NldCBhbnNpX3BhZGRpbmcgb2ZmJyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlQW5zaVdhcm5pbmdzID09PSB0cnVlKSB7XG4gICAgICBvcHRpb25zLnB1c2goJ3NldCBhbnNpX3dhcm5pbmdzIG9uJyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZUFuc2lXYXJuaW5ncyA9PT0gZmFsc2UpIHtcbiAgICAgIG9wdGlvbnMucHVzaCgnc2V0IGFuc2lfd2FybmluZ3Mgb2ZmJyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlQXJpdGhBYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgb3B0aW9ucy5wdXNoKCdzZXQgYXJpdGhhYm9ydCBvbicpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVBcml0aEFib3J0ID09PSBmYWxzZSkge1xuICAgICAgb3B0aW9ucy5wdXNoKCdzZXQgYXJpdGhhYm9ydCBvZmYnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVDb25jYXROdWxsWWllbGRzTnVsbCA9PT0gdHJ1ZSkge1xuICAgICAgb3B0aW9ucy5wdXNoKCdzZXQgY29uY2F0X251bGxfeWllbGRzX251bGwgb24nKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlQ29uY2F0TnVsbFlpZWxkc051bGwgPT09IGZhbHNlKSB7XG4gICAgICBvcHRpb25zLnB1c2goJ3NldCBjb25jYXRfbnVsbF95aWVsZHNfbnVsbCBvZmYnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVDdXJzb3JDbG9zZU9uQ29tbWl0ID09PSB0cnVlKSB7XG4gICAgICBvcHRpb25zLnB1c2goJ3NldCBjdXJzb3JfY2xvc2Vfb25fY29tbWl0IG9uJyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZUN1cnNvckNsb3NlT25Db21taXQgPT09IGZhbHNlKSB7XG4gICAgICBvcHRpb25zLnB1c2goJ3NldCBjdXJzb3JfY2xvc2Vfb25fY29tbWl0IG9mZicpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLmRhdGVmaXJzdCAhPT0gbnVsbCkge1xuICAgICAgb3B0aW9ucy5wdXNoKGBzZXQgZGF0ZWZpcnN0ICR7dGhpcy5jb25maWcub3B0aW9ucy5kYXRlZmlyc3R9YCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMuZGF0ZUZvcm1hdCAhPT0gbnVsbCkge1xuICAgICAgb3B0aW9ucy5wdXNoKGBzZXQgZGF0ZWZvcm1hdCAke3RoaXMuY29uZmlnLm9wdGlvbnMuZGF0ZUZvcm1hdH1gKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVJbXBsaWNpdFRyYW5zYWN0aW9ucyA9PT0gdHJ1ZSkge1xuICAgICAgb3B0aW9ucy5wdXNoKCdzZXQgaW1wbGljaXRfdHJhbnNhY3Rpb25zIG9uJyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLmVuYWJsZUltcGxpY2l0VHJhbnNhY3Rpb25zID09PSBmYWxzZSkge1xuICAgICAgb3B0aW9ucy5wdXNoKCdzZXQgaW1wbGljaXRfdHJhbnNhY3Rpb25zIG9mZicpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNvbmZpZy5vcHRpb25zLmxhbmd1YWdlICE9PSBudWxsKSB7XG4gICAgICBvcHRpb25zLnB1c2goYHNldCBsYW5ndWFnZSAke3RoaXMuY29uZmlnLm9wdGlvbnMubGFuZ3VhZ2V9YCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMuZW5hYmxlTnVtZXJpY1JvdW5kYWJvcnQgPT09IHRydWUpIHtcbiAgICAgIG9wdGlvbnMucHVzaCgnc2V0IG51bWVyaWNfcm91bmRhYm9ydCBvbicpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVOdW1lcmljUm91bmRhYm9ydCA9PT0gZmFsc2UpIHtcbiAgICAgIG9wdGlvbnMucHVzaCgnc2V0IG51bWVyaWNfcm91bmRhYm9ydCBvZmYnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVRdW90ZWRJZGVudGlmaWVyID09PSB0cnVlKSB7XG4gICAgICBvcHRpb25zLnB1c2goJ3NldCBxdW90ZWRfaWRlbnRpZmllciBvbicpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jb25maWcub3B0aW9ucy5lbmFibGVRdW90ZWRJZGVudGlmaWVyID09PSBmYWxzZSkge1xuICAgICAgb3B0aW9ucy5wdXNoKCdzZXQgcXVvdGVkX2lkZW50aWZpZXIgb2ZmJyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMudGV4dHNpemUgIT09IG51bGwpIHtcbiAgICAgIG9wdGlvbnMucHVzaChgc2V0IHRleHRzaXplICR7dGhpcy5jb25maWcub3B0aW9ucy50ZXh0c2l6ZX1gKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy5jb25uZWN0aW9uSXNvbGF0aW9uTGV2ZWwgIT09IG51bGwpIHtcbiAgICAgIG9wdGlvbnMucHVzaChgc2V0IHRyYW5zYWN0aW9uIGlzb2xhdGlvbiBsZXZlbCAke3RoaXMuZ2V0SXNvbGF0aW9uTGV2ZWxUZXh0KHRoaXMuY29uZmlnLm9wdGlvbnMuY29ubmVjdGlvbklzb2xhdGlvbkxldmVsKX1gKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy5hYm9ydFRyYW5zYWN0aW9uT25FcnJvciA9PT0gdHJ1ZSkge1xuICAgICAgb3B0aW9ucy5wdXNoKCdzZXQgeGFjdF9hYm9ydCBvbicpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jb25maWcub3B0aW9ucy5hYm9ydFRyYW5zYWN0aW9uT25FcnJvciA9PT0gZmFsc2UpIHtcbiAgICAgIG9wdGlvbnMucHVzaCgnc2V0IHhhY3RfYWJvcnQgb2ZmJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9wdGlvbnMuam9pbignXFxuJyk7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByb2Nlc3NlZEluaXRpYWxTcWwoKSB7XG4gICAgdGhpcy5jbGVhckNvbm5lY3RUaW1lcigpO1xuICAgIHRoaXMuZW1pdCgnY29ubmVjdCcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgdGhlIFNRTCBiYXRjaCByZXByZXNlbnRlZCBieSBbW1JlcXVlc3RdXS5cbiAgICogVGhlcmUgaXMgbm8gcGFyYW0gc3VwcG9ydCwgYW5kIHVubGlrZSBbW1JlcXVlc3QuZXhlY1NxbF1dLFxuICAgKiBpdCBpcyBub3QgbGlrZWx5IHRoYXQgU1FMIFNlcnZlciB3aWxsIHJldXNlIHRoZSBleGVjdXRpb24gcGxhbiBpdCBnZW5lcmF0ZXMgZm9yIHRoZSBTUUwuXG4gICAqXG4gICAqIEluIGFsbW9zdCBhbGwgY2FzZXMsIFtbUmVxdWVzdC5leGVjU3FsXV0gd2lsbCBiZSBhIGJldHRlciBjaG9pY2UuXG4gICAqXG4gICAqIEBwYXJhbSByZXF1ZXN0IEEgW1tSZXF1ZXN0XV0gb2JqZWN0IHJlcHJlc2VudGluZyB0aGUgcmVxdWVzdC5cbiAgICovXG4gIGV4ZWNTcWxCYXRjaChyZXF1ZXN0OiBSZXF1ZXN0KSB7XG4gICAgdGhpcy5tYWtlUmVxdWVzdChyZXF1ZXN0LCBUWVBFLlNRTF9CQVRDSCwgbmV3IFNxbEJhdGNoUGF5bG9hZChyZXF1ZXN0LnNxbFRleHRPclByb2NlZHVyZSEsIHRoaXMuY3VycmVudFRyYW5zYWN0aW9uRGVzY3JpcHRvcigpLCB0aGlzLmNvbmZpZy5vcHRpb25zKSk7XG4gIH1cblxuICAvKipcbiAgICogIEV4ZWN1dGUgdGhlIFNRTCByZXByZXNlbnRlZCBieSBbW1JlcXVlc3RdXS5cbiAgICpcbiAgICogQXMgYHNwX2V4ZWN1dGVzcWxgIGlzIHVzZWQgdG8gZXhlY3V0ZSB0aGUgU1FMLCBpZiB0aGUgc2FtZSBTUUwgaXMgZXhlY3V0ZWQgbXVsdGlwbGVzIHRpbWVzXG4gICAqIHVzaW5nIHRoaXMgZnVuY3Rpb24sIHRoZSBTUUwgU2VydmVyIHF1ZXJ5IG9wdGltaXplciBpcyBsaWtlbHkgdG8gcmV1c2UgdGhlIGV4ZWN1dGlvbiBwbGFuIGl0IGdlbmVyYXRlc1xuICAgKiBmb3IgdGhlIGZpcnN0IGV4ZWN1dGlvbi4gVGhpcyBtYXkgYWxzbyByZXN1bHQgaW4gU1FMIHNlcnZlciB0cmVhdGluZyB0aGUgcmVxdWVzdCBsaWtlIGEgc3RvcmVkIHByb2NlZHVyZVxuICAgKiB3aGljaCBjYW4gcmVzdWx0IGluIHRoZSBbW0V2ZW50X2RvbmVJblByb2NdXSBvciBbW0V2ZW50X2RvbmVQcm9jXV0gZXZlbnRzIGJlaW5nIGVtaXR0ZWQgaW5zdGVhZCBvZiB0aGVcbiAgICogW1tFdmVudF9kb25lXV0gZXZlbnQgeW91IG1pZ2h0IGV4cGVjdC4gVXNpbmcgW1tleGVjU3FsQmF0Y2hdXSB3aWxsIHByZXZlbnQgdGhpcyBmcm9tIG9jY3VycmluZyBidXQgbWF5IGhhdmUgYSBuZWdhdGl2ZSBwZXJmb3JtYW5jZSBpbXBhY3QuXG4gICAqXG4gICAqIEJld2FyZSBvZiB0aGUgd2F5IHRoYXQgc2NvcGluZyBydWxlcyBhcHBseSwgYW5kIGhvdyB0aGV5IG1heSBbYWZmZWN0IGxvY2FsIHRlbXAgdGFibGVzXShodHRwOi8vd2VibG9ncy5zcWx0ZWFtLmNvbS9tbGFkZW5wL2FyY2hpdmUvMjAwNi8xMS8wMy8xNzE5Ny5hc3B4KVxuICAgKiBJZiB5b3UncmUgcnVubmluZyBpbiB0byBzY29waW5nIGlzc3VlcywgdGhlbiBbW2V4ZWNTcWxCYXRjaF1dIG1heSBiZSBhIGJldHRlciBjaG9pY2UuXG4gICAqIFNlZSBhbHNvIFtpc3N1ZSAjMjRdKGh0dHBzOi8vZ2l0aHViLmNvbS9wZWtpbS90ZWRpb3VzL2lzc3Vlcy8yNClcbiAgICpcbiAgICogQHBhcmFtIHJlcXVlc3QgQSBbW1JlcXVlc3RdXSBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSByZXF1ZXN0LlxuICAgKi9cbiAgZXhlY1NxbChyZXF1ZXN0OiBSZXF1ZXN0KSB7XG4gICAgdHJ5IHtcbiAgICAgIHJlcXVlc3QudmFsaWRhdGVQYXJhbWV0ZXJzKHRoaXMuZGF0YWJhc2VDb2xsYXRpb24pO1xuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgIHJlcXVlc3QuZXJyb3IgPSBlcnJvcjtcblxuICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMuZGVidWcubG9nKGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICByZXF1ZXN0LmNhbGxiYWNrKGVycm9yKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1ldGVyczogUGFyYW1ldGVyW10gPSBbXTtcblxuICAgIHBhcmFtZXRlcnMucHVzaCh7XG4gICAgICB0eXBlOiBUWVBFUy5OVmFyQ2hhcixcbiAgICAgIG5hbWU6ICdzdGF0ZW1lbnQnLFxuICAgICAgdmFsdWU6IHJlcXVlc3Quc3FsVGV4dE9yUHJvY2VkdXJlLFxuICAgICAgb3V0cHV0OiBmYWxzZSxcbiAgICAgIGxlbmd0aDogdW5kZWZpbmVkLFxuICAgICAgcHJlY2lzaW9uOiB1bmRlZmluZWQsXG4gICAgICBzY2FsZTogdW5kZWZpbmVkXG4gICAgfSk7XG5cbiAgICBpZiAocmVxdWVzdC5wYXJhbWV0ZXJzLmxlbmd0aCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHtcbiAgICAgICAgdHlwZTogVFlQRVMuTlZhckNoYXIsXG4gICAgICAgIG5hbWU6ICdwYXJhbXMnLFxuICAgICAgICB2YWx1ZTogcmVxdWVzdC5tYWtlUGFyYW1zUGFyYW1ldGVyKHJlcXVlc3QucGFyYW1ldGVycyksXG4gICAgICAgIG91dHB1dDogZmFsc2UsXG4gICAgICAgIGxlbmd0aDogdW5kZWZpbmVkLFxuICAgICAgICBwcmVjaXNpb246IHVuZGVmaW5lZCxcbiAgICAgICAgc2NhbGU6IHVuZGVmaW5lZFxuICAgICAgfSk7XG5cbiAgICAgIHBhcmFtZXRlcnMucHVzaCguLi5yZXF1ZXN0LnBhcmFtZXRlcnMpO1xuICAgIH1cblxuICAgIHRoaXMubWFrZVJlcXVlc3QocmVxdWVzdCwgVFlQRS5SUENfUkVRVUVTVCwgbmV3IFJwY1JlcXVlc3RQYXlsb2FkKFByb2NlZHVyZXMuU3BfRXhlY3V0ZVNxbCwgcGFyYW1ldGVycywgdGhpcy5jdXJyZW50VHJhbnNhY3Rpb25EZXNjcmlwdG9yKCksIHRoaXMuY29uZmlnLm9wdGlvbnMsIHRoaXMuZGF0YWJhc2VDb2xsYXRpb24pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IEJ1bGtMb2FkIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gdGFibGUgVGhlIG5hbWUgb2YgdGhlIHRhYmxlIHRvIGJ1bGstaW5zZXJ0IGludG8uXG4gICAqIEBwYXJhbSBvcHRpb25zIEEgc2V0IG9mIGJ1bGsgbG9hZCBvcHRpb25zLlxuICAgKi9cbiAgbmV3QnVsa0xvYWQodGFibGU6IHN0cmluZywgY2FsbGJhY2s6IEJ1bGtMb2FkQ2FsbGJhY2spOiBCdWxrTG9hZFxuICBuZXdCdWxrTG9hZCh0YWJsZTogc3RyaW5nLCBvcHRpb25zOiBCdWxrTG9hZE9wdGlvbnMsIGNhbGxiYWNrOiBCdWxrTG9hZENhbGxiYWNrKTogQnVsa0xvYWRcbiAgbmV3QnVsa0xvYWQodGFibGU6IHN0cmluZywgY2FsbGJhY2tPck9wdGlvbnM6IEJ1bGtMb2FkT3B0aW9ucyB8IEJ1bGtMb2FkQ2FsbGJhY2ssIGNhbGxiYWNrPzogQnVsa0xvYWRDYWxsYmFjaykge1xuICAgIGxldCBvcHRpb25zOiBCdWxrTG9hZE9wdGlvbnM7XG5cbiAgICBpZiAoY2FsbGJhY2sgPT09IHVuZGVmaW5lZCkge1xuICAgICAgY2FsbGJhY2sgPSBjYWxsYmFja09yT3B0aW9ucyBhcyBCdWxrTG9hZENhbGxiYWNrO1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gY2FsbGJhY2tPck9wdGlvbnMgYXMgQnVsa0xvYWRPcHRpb25zO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wib3B0aW9uc1wiIGFyZ3VtZW50IG11c3QgYmUgYW4gb2JqZWN0Jyk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgQnVsa0xvYWQodGFibGUsIHRoaXMuZGF0YWJhc2VDb2xsYXRpb24sIHRoaXMuY29uZmlnLm9wdGlvbnMsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGEgW1tCdWxrTG9hZF1dLlxuICAgKlxuICAgKiBgYGBqc1xuICAgKiAvLyBXZSB3YW50IHRvIHBlcmZvcm0gYSBidWxrIGxvYWQgaW50byBhIHRhYmxlIHdpdGggdGhlIGZvbGxvd2luZyBmb3JtYXQ6XG4gICAqIC8vIENSRUFURSBUQUJMRSBlbXBsb3llZXMgKGZpcnN0X25hbWUgbnZhcmNoYXIoMjU1KSwgbGFzdF9uYW1lIG52YXJjaGFyKDI1NSksIGRheV9vZl9iaXJ0aCBkYXRlKTtcbiAgICpcbiAgICogY29uc3QgYnVsa0xvYWQgPSBjb25uZWN0aW9uLm5ld0J1bGtMb2FkKCdlbXBsb3llZXMnLCAoZXJyLCByb3dDb3VudCkgPT4ge1xuICAgKiAgIC8vIC4uLlxuICAgKiB9KTtcbiAgICpcbiAgICogLy8gRmlyc3QsIHdlIG5lZWQgdG8gc3BlY2lmeSB0aGUgY29sdW1ucyB0aGF0IHdlIHdhbnQgdG8gd3JpdGUgdG8sXG4gICAqIC8vIGFuZCB0aGVpciBkZWZpbml0aW9ucy4gVGhlc2UgZGVmaW5pdGlvbnMgbXVzdCBtYXRjaCB0aGUgYWN0dWFsIHRhYmxlLFxuICAgKiAvLyBvdGhlcndpc2UgdGhlIGJ1bGsgbG9hZCB3aWxsIGZhaWwuXG4gICAqIGJ1bGtMb2FkLmFkZENvbHVtbignZmlyc3RfbmFtZScsIFRZUEVTLk5WYXJjaGFyLCB7IG51bGxhYmxlOiBmYWxzZSB9KTtcbiAgICogYnVsa0xvYWQuYWRkQ29sdW1uKCdsYXN0X25hbWUnLCBUWVBFUy5OVmFyY2hhciwgeyBudWxsYWJsZTogZmFsc2UgfSk7XG4gICAqIGJ1bGtMb2FkLmFkZENvbHVtbignZGF0ZV9vZl9iaXJ0aCcsIFRZUEVTLkRhdGUsIHsgbnVsbGFibGU6IGZhbHNlIH0pO1xuICAgKlxuICAgKiAvLyBFeGVjdXRlIGEgYnVsayBsb2FkIHdpdGggYSBwcmVkZWZpbmVkIGxpc3Qgb2Ygcm93cy5cbiAgICogLy9cbiAgICogLy8gTm90ZSB0aGF0IHRoZXNlIHJvd3MgYXJlIGhlbGQgaW4gbWVtb3J5IHVudGlsIHRoZVxuICAgKiAvLyBidWxrIGxvYWQgd2FzIHBlcmZvcm1lZCwgc28gaWYgeW91IG5lZWQgdG8gd3JpdGUgYSBsYXJnZVxuICAgKiAvLyBudW1iZXIgb2Ygcm93cyAoZS5nLiBieSByZWFkaW5nIGZyb20gYSBDU1YgZmlsZSksXG4gICAqIC8vIHBhc3NpbmcgYW4gYEFzeW5jSXRlcmFibGVgIGlzIGFkdmlzYWJsZSB0byBrZWVwIG1lbW9yeSB1c2FnZSBsb3cuXG4gICAqIGNvbm5lY3Rpb24uZXhlY0J1bGtMb2FkKGJ1bGtMb2FkLCBbXG4gICAqICAgeyAnZmlyc3RfbmFtZSc6ICdTdGV2ZScsICdsYXN0X25hbWUnOiAnSm9icycsICdkYXlfb2ZfYmlydGgnOiBuZXcgRGF0ZSgnMDItMjQtMTk1NScpIH0sXG4gICAqICAgeyAnZmlyc3RfbmFtZSc6ICdCaWxsJywgJ2xhc3RfbmFtZSc6ICdHYXRlcycsICdkYXlfb2ZfYmlydGgnOiBuZXcgRGF0ZSgnMTAtMjgtMTk1NScpIH1cbiAgICogXSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gYnVsa0xvYWQgQSBwcmV2aW91c2x5IGNyZWF0ZWQgW1tCdWxrTG9hZF1dLlxuICAgKiBAcGFyYW0gcm93cyBBIFtbSXRlcmFibGVdXSBvciBbW0FzeW5jSXRlcmFibGVdXSB0aGF0IGNvbnRhaW5zIHRoZSByb3dzIHRoYXQgc2hvdWxkIGJlIGJ1bGsgbG9hZGVkLlxuICAgKi9cbiAgZXhlY0J1bGtMb2FkKGJ1bGtMb2FkOiBCdWxrTG9hZCwgcm93czogQXN5bmNJdGVyYWJsZTx1bmtub3duW10gfCB7IFtjb2x1bW5OYW1lOiBzdHJpbmddOiB1bmtub3duIH0+IHwgSXRlcmFibGU8dW5rbm93bltdIHwgeyBbY29sdW1uTmFtZTogc3RyaW5nXTogdW5rbm93biB9Pik6IHZvaWRcblxuICBleGVjQnVsa0xvYWQoYnVsa0xvYWQ6IEJ1bGtMb2FkLCByb3dzPzogQXN5bmNJdGVyYWJsZTx1bmtub3duW10gfCB7IFtjb2x1bW5OYW1lOiBzdHJpbmddOiB1bmtub3duIH0+IHwgSXRlcmFibGU8dW5rbm93bltdIHwgeyBbY29sdW1uTmFtZTogc3RyaW5nXTogdW5rbm93biB9Pikge1xuICAgIGJ1bGtMb2FkLmV4ZWN1dGlvblN0YXJ0ZWQgPSB0cnVlO1xuXG4gICAgaWYgKHJvd3MpIHtcbiAgICAgIGlmIChidWxrTG9hZC5zdHJlYW1pbmdNb2RlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvbm5lY3Rpb24uZXhlY0J1bGtMb2FkIGNhbid0IGJlIGNhbGxlZCB3aXRoIGEgQnVsa0xvYWQgdGhhdCB3YXMgcHV0IGluIHN0cmVhbWluZyBtb2RlLlwiKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJ1bGtMb2FkLmZpcnN0Um93V3JpdHRlbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb25uZWN0aW9uLmV4ZWNCdWxrTG9hZCBjYW4ndCBiZSBjYWxsZWQgd2l0aCBhIEJ1bGtMb2FkIHRoYXQgYWxyZWFkeSBoYXMgcm93cyB3cml0dGVuIHRvIGl0LlwiKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgcm93U3RyZWFtID0gUmVhZGFibGUuZnJvbShyb3dzKTtcblxuICAgICAgLy8gRGVzdHJveSB0aGUgcGFja2V0IHRyYW5zZm9ybSBpZiBhbiBlcnJvciBoYXBwZW5zIGluIHRoZSByb3cgc3RyZWFtLFxuICAgICAgLy8gZS5nLiBpZiBhbiBlcnJvciBpcyB0aHJvd24gZnJvbSB3aXRoaW4gYSBnZW5lcmF0b3Igb3Igc3RyZWFtLlxuICAgICAgcm93U3RyZWFtLm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgYnVsa0xvYWQucm93VG9QYWNrZXRUcmFuc2Zvcm0uZGVzdHJveShlcnIpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIERlc3Ryb3kgdGhlIHJvdyBzdHJlYW0gaWYgYW4gZXJyb3IgaGFwcGVucyBpbiB0aGUgcGFja2V0IHRyYW5zZm9ybSxcbiAgICAgIC8vIGUuZy4gaWYgdGhlIGJ1bGsgbG9hZCBpcyBjYW5jZWxsZWQuXG4gICAgICBidWxrTG9hZC5yb3dUb1BhY2tldFRyYW5zZm9ybS5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgIHJvd1N0cmVhbS5kZXN0cm95KGVycik7XG4gICAgICB9KTtcblxuICAgICAgcm93U3RyZWFtLnBpcGUoYnVsa0xvYWQucm93VG9QYWNrZXRUcmFuc2Zvcm0pO1xuICAgIH0gZWxzZSBpZiAoIWJ1bGtMb2FkLnN0cmVhbWluZ01vZGUpIHtcbiAgICAgIC8vIElmIHRoZSBidWxrbG9hZCB3YXMgbm90IHB1dCBpbnRvIHN0cmVhbWluZyBtb2RlIGJ5IHRoZSB1c2VyLFxuICAgICAgLy8gd2UgZW5kIHRoZSByb3dUb1BhY2tldFRyYW5zZm9ybSBoZXJlIGZvciB0aGVtLlxuICAgICAgLy9cbiAgICAgIC8vIElmIGl0IHdhcyBwdXQgaW50byBzdHJlYW1pbmcgbW9kZSwgaXQncyB0aGUgdXNlcidzIHJlc3BvbnNpYmlsaXR5XG4gICAgICAvLyB0byBlbmQgdGhlIHN0cmVhbS5cbiAgICAgIGJ1bGtMb2FkLnJvd1RvUGFja2V0VHJhbnNmb3JtLmVuZCgpO1xuICAgIH1cblxuICAgIGNvbnN0IG9uQ2FuY2VsID0gKCkgPT4ge1xuICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICB9O1xuXG4gICAgY29uc3QgcGF5bG9hZCA9IG5ldyBCdWxrTG9hZFBheWxvYWQoYnVsa0xvYWQpO1xuXG4gICAgY29uc3QgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KGJ1bGtMb2FkLmdldEJ1bGtJbnNlcnRTcWwoKSwgKGVycm9yOiAoRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfSkgfCBudWxsIHwgdW5kZWZpbmVkKSA9PiB7XG4gICAgICBidWxrTG9hZC5yZW1vdmVMaXN0ZW5lcignY2FuY2VsJywgb25DYW5jZWwpO1xuXG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yLmNvZGUgPT09ICdVTktOT1dOJykge1xuICAgICAgICAgIGVycm9yLm1lc3NhZ2UgKz0gJyBUaGlzIGlzIGxpa2VseSBiZWNhdXNlIHRoZSBzY2hlbWEgb2YgdGhlIEJ1bGtMb2FkIGRvZXMgbm90IG1hdGNoIHRoZSBzY2hlbWEgb2YgdGhlIHRhYmxlIHlvdSBhcmUgYXR0ZW1wdGluZyB0byBpbnNlcnQgaW50by4nO1xuICAgICAgICB9XG4gICAgICAgIGJ1bGtMb2FkLmVycm9yID0gZXJyb3I7XG4gICAgICAgIGJ1bGtMb2FkLmNhbGxiYWNrKGVycm9yKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLm1ha2VSZXF1ZXN0KGJ1bGtMb2FkLCBUWVBFLkJVTEtfTE9BRCwgcGF5bG9hZCk7XG4gICAgfSk7XG5cbiAgICBidWxrTG9hZC5vbmNlKCdjYW5jZWwnLCBvbkNhbmNlbCk7XG5cbiAgICB0aGlzLmV4ZWNTcWxCYXRjaChyZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwYXJlIHRoZSBTUUwgcmVwcmVzZW50ZWQgYnkgdGhlIHJlcXVlc3QuXG4gICAqXG4gICAqIFRoZSByZXF1ZXN0IGNhbiB0aGVuIGJlIHVzZWQgaW4gc3Vic2VxdWVudCBjYWxscyB0b1xuICAgKiBbW2V4ZWN1dGVdXSBhbmQgW1t1bnByZXBhcmVdXVxuICAgKlxuICAgKiBAcGFyYW0gcmVxdWVzdCBBIFtbUmVxdWVzdF1dIG9iamVjdCByZXByZXNlbnRpbmcgdGhlIHJlcXVlc3QuXG4gICAqICAgUGFyYW1ldGVycyBvbmx5IHJlcXVpcmUgYSBuYW1lIGFuZCB0eXBlLiBQYXJhbWV0ZXIgdmFsdWVzIGFyZSBpZ25vcmVkLlxuICAgKi9cbiAgcHJlcGFyZShyZXF1ZXN0OiBSZXF1ZXN0KSB7XG4gICAgY29uc3QgcGFyYW1ldGVyczogUGFyYW1ldGVyW10gPSBbXTtcblxuICAgIHBhcmFtZXRlcnMucHVzaCh7XG4gICAgICB0eXBlOiBUWVBFUy5JbnQsXG4gICAgICBuYW1lOiAnaGFuZGxlJyxcbiAgICAgIHZhbHVlOiB1bmRlZmluZWQsXG4gICAgICBvdXRwdXQ6IHRydWUsXG4gICAgICBsZW5ndGg6IHVuZGVmaW5lZCxcbiAgICAgIHByZWNpc2lvbjogdW5kZWZpbmVkLFxuICAgICAgc2NhbGU6IHVuZGVmaW5lZFxuICAgIH0pO1xuXG4gICAgcGFyYW1ldGVycy5wdXNoKHtcbiAgICAgIHR5cGU6IFRZUEVTLk5WYXJDaGFyLFxuICAgICAgbmFtZTogJ3BhcmFtcycsXG4gICAgICB2YWx1ZTogcmVxdWVzdC5wYXJhbWV0ZXJzLmxlbmd0aCA/IHJlcXVlc3QubWFrZVBhcmFtc1BhcmFtZXRlcihyZXF1ZXN0LnBhcmFtZXRlcnMpIDogbnVsbCxcbiAgICAgIG91dHB1dDogZmFsc2UsXG4gICAgICBsZW5ndGg6IHVuZGVmaW5lZCxcbiAgICAgIHByZWNpc2lvbjogdW5kZWZpbmVkLFxuICAgICAgc2NhbGU6IHVuZGVmaW5lZFxuICAgIH0pO1xuXG4gICAgcGFyYW1ldGVycy5wdXNoKHtcbiAgICAgIHR5cGU6IFRZUEVTLk5WYXJDaGFyLFxuICAgICAgbmFtZTogJ3N0bXQnLFxuICAgICAgdmFsdWU6IHJlcXVlc3Quc3FsVGV4dE9yUHJvY2VkdXJlLFxuICAgICAgb3V0cHV0OiBmYWxzZSxcbiAgICAgIGxlbmd0aDogdW5kZWZpbmVkLFxuICAgICAgcHJlY2lzaW9uOiB1bmRlZmluZWQsXG4gICAgICBzY2FsZTogdW5kZWZpbmVkXG4gICAgfSk7XG5cbiAgICByZXF1ZXN0LnByZXBhcmluZyA9IHRydWU7XG5cbiAgICAvLyBUT0RPOiBXZSBuZWVkIHRvIGNsZWFuIHVwIHRoaXMgZXZlbnQgaGFuZGxlciwgb3RoZXJ3aXNlIHRoaXMgbGVha3MgbWVtb3J5XG4gICAgcmVxdWVzdC5vbigncmV0dXJuVmFsdWUnLCAobmFtZTogc3RyaW5nLCB2YWx1ZTogYW55KSA9PiB7XG4gICAgICBpZiAobmFtZSA9PT0gJ2hhbmRsZScpIHtcbiAgICAgICAgcmVxdWVzdC5oYW5kbGUgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcXVlc3QuZXJyb3IgPSBuZXcgUmVxdWVzdEVycm9yKGBUZWRpb3VzID4gVW5leHBlY3RlZCBvdXRwdXQgcGFyYW1ldGVyICR7bmFtZX0gZnJvbSBzcF9wcmVwYXJlYCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLm1ha2VSZXF1ZXN0KHJlcXVlc3QsIFRZUEUuUlBDX1JFUVVFU1QsIG5ldyBScGNSZXF1ZXN0UGF5bG9hZChQcm9jZWR1cmVzLlNwX1ByZXBhcmUsIHBhcmFtZXRlcnMsIHRoaXMuY3VycmVudFRyYW5zYWN0aW9uRGVzY3JpcHRvcigpLCB0aGlzLmNvbmZpZy5vcHRpb25zLCB0aGlzLmRhdGFiYXNlQ29sbGF0aW9uKSk7XG4gIH1cblxuICAvKipcbiAgICogUmVsZWFzZSB0aGUgU1FMIFNlcnZlciByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIGEgcHJldmlvdXNseSBwcmVwYXJlZCByZXF1ZXN0LlxuICAgKlxuICAgKiBAcGFyYW0gcmVxdWVzdCBBIFtbUmVxdWVzdF1dIG9iamVjdCByZXByZXNlbnRpbmcgdGhlIHJlcXVlc3QuXG4gICAqICAgUGFyYW1ldGVycyBvbmx5IHJlcXVpcmUgYSBuYW1lIGFuZCB0eXBlLlxuICAgKiAgIFBhcmFtZXRlciB2YWx1ZXMgYXJlIGlnbm9yZWQuXG4gICAqL1xuICB1bnByZXBhcmUocmVxdWVzdDogUmVxdWVzdCkge1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IFBhcmFtZXRlcltdID0gW107XG5cbiAgICBwYXJhbWV0ZXJzLnB1c2goe1xuICAgICAgdHlwZTogVFlQRVMuSW50LFxuICAgICAgbmFtZTogJ2hhbmRsZScsXG4gICAgICAvLyBUT0RPOiBBYm9ydCBpZiBgcmVxdWVzdC5oYW5kbGVgIGlzIG5vdCBzZXRcbiAgICAgIHZhbHVlOiByZXF1ZXN0LmhhbmRsZSxcbiAgICAgIG91dHB1dDogZmFsc2UsXG4gICAgICBsZW5ndGg6IHVuZGVmaW5lZCxcbiAgICAgIHByZWNpc2lvbjogdW5kZWZpbmVkLFxuICAgICAgc2NhbGU6IHVuZGVmaW5lZFxuICAgIH0pO1xuXG4gICAgdGhpcy5tYWtlUmVxdWVzdChyZXF1ZXN0LCBUWVBFLlJQQ19SRVFVRVNULCBuZXcgUnBjUmVxdWVzdFBheWxvYWQoUHJvY2VkdXJlcy5TcF9VbnByZXBhcmUsIHBhcmFtZXRlcnMsIHRoaXMuY3VycmVudFRyYW5zYWN0aW9uRGVzY3JpcHRvcigpLCB0aGlzLmNvbmZpZy5vcHRpb25zLCB0aGlzLmRhdGFiYXNlQ29sbGF0aW9uKSk7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSBwcmV2aW91c2x5IHByZXBhcmVkIFNRTCwgdXNpbmcgdGhlIHN1cHBsaWVkIHBhcmFtZXRlcnMuXG4gICAqXG4gICAqIEBwYXJhbSByZXF1ZXN0IEEgcHJldmlvdXNseSBwcmVwYXJlZCBbW1JlcXVlc3RdXS5cbiAgICogQHBhcmFtIHBhcmFtZXRlcnMgIEFuIG9iamVjdCB3aG9zZSBuYW1lcyBjb3JyZXNwb25kIHRvIHRoZSBuYW1lcyBvZlxuICAgKiAgIHBhcmFtZXRlcnMgdGhhdCB3ZXJlIGFkZGVkIHRvIHRoZSBbW1JlcXVlc3RdXSBiZWZvcmUgaXQgd2FzIHByZXBhcmVkLlxuICAgKiAgIFRoZSBvYmplY3QncyB2YWx1ZXMgYXJlIHBhc3NlZCBhcyB0aGUgcGFyYW1ldGVycycgdmFsdWVzIHdoZW4gdGhlXG4gICAqICAgcmVxdWVzdCBpcyBleGVjdXRlZC5cbiAgICovXG4gIGV4ZWN1dGUocmVxdWVzdDogUmVxdWVzdCwgcGFyYW1ldGVycz86IHsgW2tleTogc3RyaW5nXTogdW5rbm93biB9KSB7XG4gICAgY29uc3QgZXhlY3V0ZVBhcmFtZXRlcnM6IFBhcmFtZXRlcltdID0gW107XG5cbiAgICBleGVjdXRlUGFyYW1ldGVycy5wdXNoKHtcbiAgICAgIHR5cGU6IFRZUEVTLkludCxcbiAgICAgIG5hbWU6ICcnLFxuICAgICAgLy8gVE9ETzogQWJvcnQgaWYgYHJlcXVlc3QuaGFuZGxlYCBpcyBub3Qgc2V0XG4gICAgICB2YWx1ZTogcmVxdWVzdC5oYW5kbGUsXG4gICAgICBvdXRwdXQ6IGZhbHNlLFxuICAgICAgbGVuZ3RoOiB1bmRlZmluZWQsXG4gICAgICBwcmVjaXNpb246IHVuZGVmaW5lZCxcbiAgICAgIHNjYWxlOiB1bmRlZmluZWRcbiAgICB9KTtcblxuICAgIHRyeSB7XG4gICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcmVxdWVzdC5wYXJhbWV0ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtZXRlciA9IHJlcXVlc3QucGFyYW1ldGVyc1tpXTtcblxuICAgICAgICBleGVjdXRlUGFyYW1ldGVycy5wdXNoKHtcbiAgICAgICAgICAuLi5wYXJhbWV0ZXIsXG4gICAgICAgICAgdmFsdWU6IHBhcmFtZXRlci50eXBlLnZhbGlkYXRlKHBhcmFtZXRlcnMgPyBwYXJhbWV0ZXJzW3BhcmFtZXRlci5uYW1lXSA6IG51bGwsIHRoaXMuZGF0YWJhc2VDb2xsYXRpb24pXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgIHJlcXVlc3QuZXJyb3IgPSBlcnJvcjtcblxuICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMuZGVidWcubG9nKGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICByZXF1ZXN0LmNhbGxiYWNrKGVycm9yKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5tYWtlUmVxdWVzdChyZXF1ZXN0LCBUWVBFLlJQQ19SRVFVRVNULCBuZXcgUnBjUmVxdWVzdFBheWxvYWQoUHJvY2VkdXJlcy5TcF9FeGVjdXRlLCBleGVjdXRlUGFyYW1ldGVycywgdGhpcy5jdXJyZW50VHJhbnNhY3Rpb25EZXNjcmlwdG9yKCksIHRoaXMuY29uZmlnLm9wdGlvbnMsIHRoaXMuZGF0YWJhc2VDb2xsYXRpb24pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsIGEgc3RvcmVkIHByb2NlZHVyZSByZXByZXNlbnRlZCBieSBbW1JlcXVlc3RdXS5cbiAgICpcbiAgICogQHBhcmFtIHJlcXVlc3QgQSBbW1JlcXVlc3RdXSBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSByZXF1ZXN0LlxuICAgKi9cbiAgY2FsbFByb2NlZHVyZShyZXF1ZXN0OiBSZXF1ZXN0KSB7XG4gICAgdHJ5IHtcbiAgICAgIHJlcXVlc3QudmFsaWRhdGVQYXJhbWV0ZXJzKHRoaXMuZGF0YWJhc2VDb2xsYXRpb24pO1xuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgIHJlcXVlc3QuZXJyb3IgPSBlcnJvcjtcblxuICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMuZGVidWcubG9nKGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICByZXF1ZXN0LmNhbGxiYWNrKGVycm9yKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5tYWtlUmVxdWVzdChyZXF1ZXN0LCBUWVBFLlJQQ19SRVFVRVNULCBuZXcgUnBjUmVxdWVzdFBheWxvYWQocmVxdWVzdC5zcWxUZXh0T3JQcm9jZWR1cmUhLCByZXF1ZXN0LnBhcmFtZXRlcnMsIHRoaXMuY3VycmVudFRyYW5zYWN0aW9uRGVzY3JpcHRvcigpLCB0aGlzLmNvbmZpZy5vcHRpb25zLCB0aGlzLmRhdGFiYXNlQ29sbGF0aW9uKSk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSB0cmFuc2FjdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAqIEBwYXJhbSBuYW1lIEEgc3RyaW5nIHJlcHJlc2VudGluZyBhIG5hbWUgdG8gYXNzb2NpYXRlIHdpdGggdGhlIHRyYW5zYWN0aW9uLlxuICAgKiAgIE9wdGlvbmFsLCBhbmQgZGVmYXVsdHMgdG8gYW4gZW1wdHkgc3RyaW5nLiBSZXF1aXJlZCB3aGVuIGBpc29sYXRpb25MZXZlbGBcbiAgICogICBpcyBwcmVzZW50LlxuICAgKiBAcGFyYW0gaXNvbGF0aW9uTGV2ZWwgVGhlIGlzb2xhdGlvbiBsZXZlbCB0aGF0IHRoZSB0cmFuc2FjdGlvbiBpcyB0byBiZSBydW4gd2l0aC5cbiAgICpcbiAgICogICBUaGUgaXNvbGF0aW9uIGxldmVscyBhcmUgYXZhaWxhYmxlIGZyb20gYHJlcXVpcmUoJ3RlZGlvdXMnKS5JU09MQVRJT05fTEVWRUxgLlxuICAgKiAgICogYFJFQURfVU5DT01NSVRURURgXG4gICAqICAgKiBgUkVBRF9DT01NSVRURURgXG4gICAqICAgKiBgUkVQRUFUQUJMRV9SRUFEYFxuICAgKiAgICogYFNFUklBTElaQUJMRWBcbiAgICogICAqIGBTTkFQU0hPVGBcbiAgICpcbiAgICogICBPcHRpb25hbCwgYW5kIGRlZmF1bHRzIHRvIHRoZSBDb25uZWN0aW9uJ3MgaXNvbGF0aW9uIGxldmVsLlxuICAgKi9cbiAgYmVnaW5UcmFuc2FjdGlvbihjYWxsYmFjazogQmVnaW5UcmFuc2FjdGlvbkNhbGxiYWNrLCBuYW1lID0gJycsIGlzb2xhdGlvbkxldmVsID0gdGhpcy5jb25maWcub3B0aW9ucy5pc29sYXRpb25MZXZlbCkge1xuICAgIGFzc2VydFZhbGlkSXNvbGF0aW9uTGV2ZWwoaXNvbGF0aW9uTGV2ZWwsICdpc29sYXRpb25MZXZlbCcpO1xuXG4gICAgY29uc3QgdHJhbnNhY3Rpb24gPSBuZXcgVHJhbnNhY3Rpb24obmFtZSwgaXNvbGF0aW9uTGV2ZWwpO1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMudGRzVmVyc2lvbiA8ICc3XzInKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjU3FsQmF0Y2gobmV3IFJlcXVlc3QoJ1NFVCBUUkFOU0FDVElPTiBJU09MQVRJT04gTEVWRUwgJyArICh0cmFuc2FjdGlvbi5pc29sYXRpb25MZXZlbFRvVFNRTCgpKSArICc7QkVHSU4gVFJBTiAnICsgdHJhbnNhY3Rpb24ubmFtZSwgKGVycikgPT4ge1xuICAgICAgICB0aGlzLnRyYW5zYWN0aW9uRGVwdGgrKztcbiAgICAgICAgaWYgKHRoaXMudHJhbnNhY3Rpb25EZXB0aCA9PT0gMSkge1xuICAgICAgICAgIHRoaXMuaW5UcmFuc2FjdGlvbiA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXF1ZXN0ID0gbmV3IFJlcXVlc3QodW5kZWZpbmVkLCAoZXJyKSA9PiB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCB0aGlzLmN1cnJlbnRUcmFuc2FjdGlvbkRlc2NyaXB0b3IoKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMubWFrZVJlcXVlc3QocmVxdWVzdCwgVFlQRS5UUkFOU0FDVElPTl9NQU5BR0VSLCB0cmFuc2FjdGlvbi5iZWdpblBheWxvYWQodGhpcy5jdXJyZW50VHJhbnNhY3Rpb25EZXNjcmlwdG9yKCkpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21taXQgYSB0cmFuc2FjdGlvbi5cbiAgICpcbiAgICogVGhlcmUgc2hvdWxkIGJlIGFuIGFjdGl2ZSB0cmFuc2FjdGlvbiAtIHRoYXQgaXMsIFtbYmVnaW5UcmFuc2FjdGlvbl1dXG4gICAqIHNob3VsZCBoYXZlIGJlZW4gcHJldmlvdXNseSBjYWxsZWQuXG4gICAqXG4gICAqIEBwYXJhbSBjYWxsYmFja1xuICAgKiBAcGFyYW0gbmFtZSBBIHN0cmluZyByZXByZXNlbnRpbmcgYSBuYW1lIHRvIGFzc29jaWF0ZSB3aXRoIHRoZSB0cmFuc2FjdGlvbi5cbiAgICogICBPcHRpb25hbCwgYW5kIGRlZmF1bHRzIHRvIGFuIGVtcHR5IHN0cmluZy4gUmVxdWlyZWQgd2hlbiBgaXNvbGF0aW9uTGV2ZWxgaXMgcHJlc2VudC5cbiAgICovXG4gIGNvbW1pdFRyYW5zYWN0aW9uKGNhbGxiYWNrOiBDb21taXRUcmFuc2FjdGlvbkNhbGxiYWNrLCBuYW1lID0gJycpIHtcbiAgICBjb25zdCB0cmFuc2FjdGlvbiA9IG5ldyBUcmFuc2FjdGlvbihuYW1lKTtcbiAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy50ZHNWZXJzaW9uIDwgJzdfMicpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWNTcWxCYXRjaChuZXcgUmVxdWVzdCgnQ09NTUlUIFRSQU4gJyArIHRyYW5zYWN0aW9uLm5hbWUsIChlcnIpID0+IHtcbiAgICAgICAgdGhpcy50cmFuc2FjdGlvbkRlcHRoLS07XG4gICAgICAgIGlmICh0aGlzLnRyYW5zYWN0aW9uRGVwdGggPT09IDApIHtcbiAgICAgICAgICB0aGlzLmluVHJhbnNhY3Rpb24gPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9KSk7XG4gICAgfVxuICAgIGNvbnN0IHJlcXVlc3QgPSBuZXcgUmVxdWVzdCh1bmRlZmluZWQsIGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcy5tYWtlUmVxdWVzdChyZXF1ZXN0LCBUWVBFLlRSQU5TQUNUSU9OX01BTkFHRVIsIHRyYW5zYWN0aW9uLmNvbW1pdFBheWxvYWQodGhpcy5jdXJyZW50VHJhbnNhY3Rpb25EZXNjcmlwdG9yKCkpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSb2xsYmFjayBhIHRyYW5zYWN0aW9uLlxuICAgKlxuICAgKiBUaGVyZSBzaG91bGQgYmUgYW4gYWN0aXZlIHRyYW5zYWN0aW9uIC0gdGhhdCBpcywgW1tiZWdpblRyYW5zYWN0aW9uXV1cbiAgICogc2hvdWxkIGhhdmUgYmVlbiBwcmV2aW91c2x5IGNhbGxlZC5cbiAgICpcbiAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAqIEBwYXJhbSBuYW1lIEEgc3RyaW5nIHJlcHJlc2VudGluZyBhIG5hbWUgdG8gYXNzb2NpYXRlIHdpdGggdGhlIHRyYW5zYWN0aW9uLlxuICAgKiAgIE9wdGlvbmFsLCBhbmQgZGVmYXVsdHMgdG8gYW4gZW1wdHkgc3RyaW5nLlxuICAgKiAgIFJlcXVpcmVkIHdoZW4gYGlzb2xhdGlvbkxldmVsYCBpcyBwcmVzZW50LlxuICAgKi9cbiAgcm9sbGJhY2tUcmFuc2FjdGlvbihjYWxsYmFjazogUm9sbGJhY2tUcmFuc2FjdGlvbkNhbGxiYWNrLCBuYW1lID0gJycpIHtcbiAgICBjb25zdCB0cmFuc2FjdGlvbiA9IG5ldyBUcmFuc2FjdGlvbihuYW1lKTtcbiAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy50ZHNWZXJzaW9uIDwgJzdfMicpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWNTcWxCYXRjaChuZXcgUmVxdWVzdCgnUk9MTEJBQ0sgVFJBTiAnICsgdHJhbnNhY3Rpb24ubmFtZSwgKGVycikgPT4ge1xuICAgICAgICB0aGlzLnRyYW5zYWN0aW9uRGVwdGgtLTtcbiAgICAgICAgaWYgKHRoaXMudHJhbnNhY3Rpb25EZXB0aCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMuaW5UcmFuc2FjdGlvbiA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9KSk7XG4gICAgfVxuICAgIGNvbnN0IHJlcXVlc3QgPSBuZXcgUmVxdWVzdCh1bmRlZmluZWQsIGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcy5tYWtlUmVxdWVzdChyZXF1ZXN0LCBUWVBFLlRSQU5TQUNUSU9OX01BTkFHRVIsIHRyYW5zYWN0aW9uLnJvbGxiYWNrUGF5bG9hZCh0aGlzLmN1cnJlbnRUcmFuc2FjdGlvbkRlc2NyaXB0b3IoKSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBhIHNhdmVwb2ludCB3aXRoaW4gYSB0cmFuc2FjdGlvbi5cbiAgICpcbiAgICogVGhlcmUgc2hvdWxkIGJlIGFuIGFjdGl2ZSB0cmFuc2FjdGlvbiAtIHRoYXQgaXMsIFtbYmVnaW5UcmFuc2FjdGlvbl1dXG4gICAqIHNob3VsZCBoYXZlIGJlZW4gcHJldmlvdXNseSBjYWxsZWQuXG4gICAqXG4gICAqIEBwYXJhbSBjYWxsYmFja1xuICAgKiBAcGFyYW0gbmFtZSBBIHN0cmluZyByZXByZXNlbnRpbmcgYSBuYW1lIHRvIGFzc29jaWF0ZSB3aXRoIHRoZSB0cmFuc2FjdGlvbi5cXFxuICAgKiAgIE9wdGlvbmFsLCBhbmQgZGVmYXVsdHMgdG8gYW4gZW1wdHkgc3RyaW5nLlxuICAgKiAgIFJlcXVpcmVkIHdoZW4gYGlzb2xhdGlvbkxldmVsYCBpcyBwcmVzZW50LlxuICAgKi9cbiAgc2F2ZVRyYW5zYWN0aW9uKGNhbGxiYWNrOiBTYXZlVHJhbnNhY3Rpb25DYWxsYmFjaywgbmFtZTogc3RyaW5nKSB7XG4gICAgY29uc3QgdHJhbnNhY3Rpb24gPSBuZXcgVHJhbnNhY3Rpb24obmFtZSk7XG4gICAgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMudGRzVmVyc2lvbiA8ICc3XzInKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjU3FsQmF0Y2gobmV3IFJlcXVlc3QoJ1NBVkUgVFJBTiAnICsgdHJhbnNhY3Rpb24ubmFtZSwgKGVycikgPT4ge1xuICAgICAgICB0aGlzLnRyYW5zYWN0aW9uRGVwdGgrKztcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIH0pKTtcbiAgICB9XG4gICAgY29uc3QgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KHVuZGVmaW5lZCwgY2FsbGJhY2spO1xuICAgIHJldHVybiB0aGlzLm1ha2VSZXF1ZXN0KHJlcXVlc3QsIFRZUEUuVFJBTlNBQ1RJT05fTUFOQUdFUiwgdHJhbnNhY3Rpb24uc2F2ZVBheWxvYWQodGhpcy5jdXJyZW50VHJhbnNhY3Rpb25EZXNjcmlwdG9yKCkpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSdW4gdGhlIGdpdmVuIGNhbGxiYWNrIGFmdGVyIHN0YXJ0aW5nIGEgdHJhbnNhY3Rpb24sIGFuZCBjb21taXQgb3JcbiAgICogcm9sbGJhY2sgdGhlIHRyYW5zYWN0aW9uIGFmdGVyd2FyZHMuXG4gICAqXG4gICAqIFRoaXMgaXMgYSBoZWxwZXIgdGhhdCBlbXBsb3lzIFtbYmVnaW5UcmFuc2FjdGlvbl1dLCBbW2NvbW1pdFRyYW5zYWN0aW9uXV0sXG4gICAqIFtbcm9sbGJhY2tUcmFuc2FjdGlvbl1dLCBhbmQgW1tzYXZlVHJhbnNhY3Rpb25dXSB0byBncmVhdGx5IHNpbXBsaWZ5IHRoZVxuICAgKiB1c2Ugb2YgZGF0YWJhc2UgdHJhbnNhY3Rpb25zIGFuZCBhdXRvbWF0aWNhbGx5IGhhbmRsZSB0cmFuc2FjdGlvbiBuZXN0aW5nLlxuICAgKlxuICAgKiBAcGFyYW0gY2JcbiAgICogQHBhcmFtIGlzb2xhdGlvbkxldmVsXG4gICAqICAgVGhlIGlzb2xhdGlvbiBsZXZlbCB0aGF0IHRoZSB0cmFuc2FjdGlvbiBpcyB0byBiZSBydW4gd2l0aC5cbiAgICpcbiAgICogICBUaGUgaXNvbGF0aW9uIGxldmVscyBhcmUgYXZhaWxhYmxlIGZyb20gYHJlcXVpcmUoJ3RlZGlvdXMnKS5JU09MQVRJT05fTEVWRUxgLlxuICAgKiAgICogYFJFQURfVU5DT01NSVRURURgXG4gICAqICAgKiBgUkVBRF9DT01NSVRURURgXG4gICAqICAgKiBgUkVQRUFUQUJMRV9SRUFEYFxuICAgKiAgICogYFNFUklBTElaQUJMRWBcbiAgICogICAqIGBTTkFQU0hPVGBcbiAgICpcbiAgICogICBPcHRpb25hbCwgYW5kIGRlZmF1bHRzIHRvIHRoZSBDb25uZWN0aW9uJ3MgaXNvbGF0aW9uIGxldmVsLlxuICAgKi9cbiAgdHJhbnNhY3Rpb24oY2I6IChlcnI6IEVycm9yIHwgbnVsbCB8IHVuZGVmaW5lZCwgdHhEb25lPzogPFQgZXh0ZW5kcyBUcmFuc2FjdGlvbkRvbmVDYWxsYmFjaz4oZXJyOiBFcnJvciB8IG51bGwgfCB1bmRlZmluZWQsIGRvbmU6IFQsIC4uLmFyZ3M6IENhbGxiYWNrUGFyYW1ldGVyczxUPikgPT4gdm9pZCkgPT4gdm9pZCwgaXNvbGF0aW9uTGV2ZWw/OiB0eXBlb2YgSVNPTEFUSU9OX0xFVkVMW2tleW9mIHR5cGVvZiBJU09MQVRJT05fTEVWRUxdKSB7XG4gICAgaWYgKHR5cGVvZiBjYiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYGNiYCBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VTYXZlcG9pbnQgPSB0aGlzLmluVHJhbnNhY3Rpb247XG4gICAgY29uc3QgbmFtZSA9ICdfdGVkaW91c18nICsgKGNyeXB0by5yYW5kb21CeXRlcygxMCkudG9TdHJpbmcoJ2hleCcpKTtcbiAgICBjb25zdCB0eERvbmU6IDxUIGV4dGVuZHMgVHJhbnNhY3Rpb25Eb25lQ2FsbGJhY2s+KGVycjogRXJyb3IgfCBudWxsIHwgdW5kZWZpbmVkLCBkb25lOiBULCAuLi5hcmdzOiBDYWxsYmFja1BhcmFtZXRlcnM8VD4pID0+IHZvaWQgPSAoZXJyLCBkb25lLCAuLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGlmICh0aGlzLmluVHJhbnNhY3Rpb24gJiYgdGhpcy5zdGF0ZSA9PT0gdGhpcy5TVEFURS5MT0dHRURfSU4pIHtcbiAgICAgICAgICB0aGlzLnJvbGxiYWNrVHJhbnNhY3Rpb24oKHR4RXJyKSA9PiB7XG4gICAgICAgICAgICBkb25lKHR4RXJyIHx8IGVyciwgLi4uYXJncyk7XG4gICAgICAgICAgfSwgbmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZG9uZShlcnIsIC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHVzZVNhdmVwb2ludCkge1xuICAgICAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy50ZHNWZXJzaW9uIDwgJzdfMicpIHtcbiAgICAgICAgICB0aGlzLnRyYW5zYWN0aW9uRGVwdGgtLTtcbiAgICAgICAgfVxuICAgICAgICBkb25lKG51bGwsIC4uLmFyZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jb21taXRUcmFuc2FjdGlvbigodHhFcnIpID0+IHtcbiAgICAgICAgICBkb25lKHR4RXJyLCAuLi5hcmdzKTtcbiAgICAgICAgfSwgbmFtZSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmICh1c2VTYXZlcG9pbnQpIHtcbiAgICAgIHJldHVybiB0aGlzLnNhdmVUcmFuc2FjdGlvbigoZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc29sYXRpb25MZXZlbCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWNTcWxCYXRjaChuZXcgUmVxdWVzdCgnU0VUIHRyYW5zYWN0aW9uIGlzb2xhdGlvbiBsZXZlbCAnICsgdGhpcy5nZXRJc29sYXRpb25MZXZlbFRleHQoaXNvbGF0aW9uTGV2ZWwpLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gY2IoZXJyLCB0eERvbmUpO1xuICAgICAgICAgIH0pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gY2IobnVsbCwgdHhEb25lKTtcbiAgICAgICAgfVxuICAgICAgfSwgbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLmJlZ2luVHJhbnNhY3Rpb24oKGVycikgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2IobnVsbCwgdHhEb25lKTtcbiAgICAgIH0sIG5hbWUsIGlzb2xhdGlvbkxldmVsKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIG1ha2VSZXF1ZXN0KHJlcXVlc3Q6IFJlcXVlc3QgfCBCdWxrTG9hZCwgcGFja2V0VHlwZTogbnVtYmVyLCBwYXlsb2FkOiAoSXRlcmFibGU8QnVmZmVyPiB8IEFzeW5jSXRlcmFibGU8QnVmZmVyPikgJiB7IHRvU3RyaW5nOiAoaW5kZW50Pzogc3RyaW5nKSA9PiBzdHJpbmcgfSkge1xuICAgIGlmICh0aGlzLnN0YXRlICE9PSB0aGlzLlNUQVRFLkxPR0dFRF9JTikge1xuICAgICAgY29uc3QgbWVzc2FnZSA9ICdSZXF1ZXN0cyBjYW4gb25seSBiZSBtYWRlIGluIHRoZSAnICsgdGhpcy5TVEFURS5MT0dHRURfSU4ubmFtZSArICcgc3RhdGUsIG5vdCB0aGUgJyArIHRoaXMuc3RhdGUubmFtZSArICcgc3RhdGUnO1xuICAgICAgdGhpcy5kZWJ1Zy5sb2cobWVzc2FnZSk7XG4gICAgICByZXF1ZXN0LmNhbGxiYWNrKG5ldyBSZXF1ZXN0RXJyb3IobWVzc2FnZSwgJ0VJTlZBTElEU1RBVEUnKSk7XG4gICAgfSBlbHNlIGlmIChyZXF1ZXN0LmNhbmNlbGVkKSB7XG4gICAgICBwcm9jZXNzLm5leHRUaWNrKCgpID0+IHtcbiAgICAgICAgcmVxdWVzdC5jYWxsYmFjayhuZXcgUmVxdWVzdEVycm9yKCdDYW5jZWxlZC4nLCAnRUNBTkNFTCcpKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocGFja2V0VHlwZSA9PT0gVFlQRS5TUUxfQkFUQ0gpIHtcbiAgICAgICAgdGhpcy5pc1NxbEJhdGNoID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaXNTcWxCYXRjaCA9IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0O1xuICAgICAgcmVxdWVzdC5jb25uZWN0aW9uISA9IHRoaXM7XG4gICAgICByZXF1ZXN0LnJvd0NvdW50ISA9IDA7XG4gICAgICByZXF1ZXN0LnJvd3MhID0gW107XG4gICAgICByZXF1ZXN0LnJzdCEgPSBbXTtcblxuICAgICAgY29uc3Qgb25DYW5jZWwgPSAoKSA9PiB7XG4gICAgICAgIHBheWxvYWRTdHJlYW0udW5waXBlKG1lc3NhZ2UpO1xuICAgICAgICBwYXlsb2FkU3RyZWFtLmRlc3Ryb3kobmV3IFJlcXVlc3RFcnJvcignQ2FuY2VsZWQuJywgJ0VDQU5DRUwnKSk7XG5cbiAgICAgICAgLy8gc2V0IHRoZSBpZ25vcmUgYml0IGFuZCBlbmQgdGhlIG1lc3NhZ2UuXG4gICAgICAgIG1lc3NhZ2UuaWdub3JlID0gdHJ1ZTtcbiAgICAgICAgbWVzc2FnZS5lbmQoKTtcblxuICAgICAgICBpZiAocmVxdWVzdCBpbnN0YW5jZW9mIFJlcXVlc3QgJiYgcmVxdWVzdC5wYXVzZWQpIHtcbiAgICAgICAgICAvLyByZXN1bWUgdGhlIHJlcXVlc3QgaWYgaXQgd2FzIHBhdXNlZCBzbyB3ZSBjYW4gcmVhZCB0aGUgcmVtYWluaW5nIHRva2Vuc1xuICAgICAgICAgIHJlcXVlc3QucmVzdW1lKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHJlcXVlc3Qub25jZSgnY2FuY2VsJywgb25DYW5jZWwpO1xuXG4gICAgICB0aGlzLmNyZWF0ZVJlcXVlc3RUaW1lcigpO1xuXG4gICAgICBjb25zdCBtZXNzYWdlID0gbmV3IE1lc3NhZ2UoeyB0eXBlOiBwYWNrZXRUeXBlLCByZXNldENvbm5lY3Rpb246IHRoaXMucmVzZXRDb25uZWN0aW9uT25OZXh0UmVxdWVzdCB9KTtcbiAgICAgIHRoaXMubWVzc2FnZUlvLm91dGdvaW5nTWVzc2FnZVN0cmVhbS53cml0ZShtZXNzYWdlKTtcbiAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuU0VOVF9DTElFTlRfUkVRVUVTVCk7XG5cbiAgICAgIG1lc3NhZ2Uub25jZSgnZmluaXNoJywgKCkgPT4ge1xuICAgICAgICByZXF1ZXN0LnJlbW92ZUxpc3RlbmVyKCdjYW5jZWwnLCBvbkNhbmNlbCk7XG4gICAgICAgIHJlcXVlc3Qub25jZSgnY2FuY2VsJywgdGhpcy5fY2FuY2VsQWZ0ZXJSZXF1ZXN0U2VudCk7XG5cbiAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb25Pbk5leHRSZXF1ZXN0ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZGVidWcucGF5bG9hZChmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gcGF5bG9hZCEudG9TdHJpbmcoJyAgJyk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHBheWxvYWRTdHJlYW0gPSBSZWFkYWJsZS5mcm9tKHBheWxvYWQpO1xuICAgICAgcGF5bG9hZFN0cmVhbS5vbmNlKCdlcnJvcicsIChlcnJvcikgPT4ge1xuICAgICAgICBwYXlsb2FkU3RyZWFtLnVucGlwZShtZXNzYWdlKTtcblxuICAgICAgICAvLyBPbmx5IHNldCBhIHJlcXVlc3QgZXJyb3IgaWYgbm8gZXJyb3Igd2FzIHNldCB5ZXQuXG4gICAgICAgIHJlcXVlc3QuZXJyb3IgPz89IGVycm9yO1xuXG4gICAgICAgIG1lc3NhZ2UuaWdub3JlID0gdHJ1ZTtcbiAgICAgICAgbWVzc2FnZS5lbmQoKTtcbiAgICAgIH0pO1xuICAgICAgcGF5bG9hZFN0cmVhbS5waXBlKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYW5jZWwgY3VycmVudGx5IGV4ZWN1dGVkIHJlcXVlc3QuXG4gICAqL1xuICBjYW5jZWwoKSB7XG4gICAgaWYgKCF0aGlzLnJlcXVlc3QpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5yZXF1ZXN0LmNhbmNlbGVkKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdGhpcy5yZXF1ZXN0LmNhbmNlbCgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHRoZSBjb25uZWN0aW9uIHRvIGl0cyBpbml0aWFsIHN0YXRlLlxuICAgKiBDYW4gYmUgdXNlZnVsIGZvciBjb25uZWN0aW9uIHBvb2wgaW1wbGVtZW50YXRpb25zLlxuICAgKlxuICAgKiBAcGFyYW0gY2FsbGJhY2tcbiAgICovXG4gIHJlc2V0KGNhbGxiYWNrOiBSZXNldENhbGxiYWNrKSB7XG4gICAgY29uc3QgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KHRoaXMuZ2V0SW5pdGlhbFNxbCgpLCAoZXJyKSA9PiB7XG4gICAgICBpZiAodGhpcy5jb25maWcub3B0aW9ucy50ZHNWZXJzaW9uIDwgJzdfMicpIHtcbiAgICAgICAgdGhpcy5pblRyYW5zYWN0aW9uID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH0pO1xuICAgIHRoaXMucmVzZXRDb25uZWN0aW9uT25OZXh0UmVxdWVzdCA9IHRydWU7XG4gICAgdGhpcy5leGVjU3FsQmF0Y2gocmVxdWVzdCk7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGN1cnJlbnRUcmFuc2FjdGlvbkRlc2NyaXB0b3IoKSB7XG4gICAgcmV0dXJuIHRoaXMudHJhbnNhY3Rpb25EZXNjcmlwdG9yc1t0aGlzLnRyYW5zYWN0aW9uRGVzY3JpcHRvcnMubGVuZ3RoIC0gMV07XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGdldElzb2xhdGlvbkxldmVsVGV4dChpc29sYXRpb25MZXZlbDogdHlwZW9mIElTT0xBVElPTl9MRVZFTFtrZXlvZiB0eXBlb2YgSVNPTEFUSU9OX0xFVkVMXSkge1xuICAgIHN3aXRjaCAoaXNvbGF0aW9uTGV2ZWwpIHtcbiAgICAgIGNhc2UgSVNPTEFUSU9OX0xFVkVMLlJFQURfVU5DT01NSVRURUQ6XG4gICAgICAgIHJldHVybiAncmVhZCB1bmNvbW1pdHRlZCc7XG4gICAgICBjYXNlIElTT0xBVElPTl9MRVZFTC5SRVBFQVRBQkxFX1JFQUQ6XG4gICAgICAgIHJldHVybiAncmVwZWF0YWJsZSByZWFkJztcbiAgICAgIGNhc2UgSVNPTEFUSU9OX0xFVkVMLlNFUklBTElaQUJMRTpcbiAgICAgICAgcmV0dXJuICdzZXJpYWxpemFibGUnO1xuICAgICAgY2FzZSBJU09MQVRJT05fTEVWRUwuU05BUFNIT1Q6XG4gICAgICAgIHJldHVybiAnc25hcHNob3QnO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuICdyZWFkIGNvbW1pdHRlZCc7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzVHJhbnNpZW50RXJyb3IoZXJyb3I6IEFnZ3JlZ2F0ZUVycm9yIHwgQ29ubmVjdGlvbkVycm9yKTogYm9vbGVhbiB7XG4gIGlmIChlcnJvciBpbnN0YW5jZW9mIEFnZ3JlZ2F0ZUVycm9yKSB7XG4gICAgZXJyb3IgPSBlcnJvci5lcnJvcnNbMF07XG4gIH1cbiAgcmV0dXJuIChlcnJvciBpbnN0YW5jZW9mIENvbm5lY3Rpb25FcnJvcikgJiYgISFlcnJvci5pc1RyYW5zaWVudDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGlvbjtcbm1vZHVsZS5leHBvcnRzID0gQ29ubmVjdGlvbjtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuU1RBVEUgPSB7XG4gIElOSVRJQUxJWkVEOiB7XG4gICAgbmFtZTogJ0luaXRpYWxpemVkJyxcbiAgICBldmVudHM6IHt9XG4gIH0sXG4gIENPTk5FQ1RJTkc6IHtcbiAgICBuYW1lOiAnQ29ubmVjdGluZycsXG4gICAgZW50ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5pbml0aWFsaXNlQ29ubmVjdGlvbigpO1xuICAgIH0sXG4gICAgZXZlbnRzOiB7XG4gICAgICBzb2NrZXRFcnJvcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuRklOQUwpO1xuICAgICAgfSxcbiAgICAgIGNvbm5lY3RUaW1lb3V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBTRU5UX1BSRUxPR0lOOiB7XG4gICAgbmFtZTogJ1NlbnRQcmVsb2dpbicsXG4gICAgZW50ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgbGV0IG1lc3NhZ2VCdWZmZXIgPSBCdWZmZXIuYWxsb2MoMCk7XG5cbiAgICAgICAgbGV0IG1lc3NhZ2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbWVzc2FnZSA9IGF3YWl0IHRoaXMubWVzc2FnZUlvLnJlYWRNZXNzYWdlKCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc29ja2V0RXJyb3IoZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgZGF0YSBvZiBtZXNzYWdlKSB7XG4gICAgICAgICAgbWVzc2FnZUJ1ZmZlciA9IEJ1ZmZlci5jb25jYXQoW21lc3NhZ2VCdWZmZXIsIGRhdGFdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByZWxvZ2luUGF5bG9hZCA9IG5ldyBQcmVsb2dpblBheWxvYWQobWVzc2FnZUJ1ZmZlcik7XG4gICAgICAgIHRoaXMuZGVidWcucGF5bG9hZChmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gcHJlbG9naW5QYXlsb2FkLnRvU3RyaW5nKCcgICcpO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAocHJlbG9naW5QYXlsb2FkLmZlZEF1dGhSZXF1aXJlZCA9PT0gMSkge1xuICAgICAgICAgIHRoaXMuZmVkQXV0aFJlcXVpcmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoJ3N0cmljdCcgIT09IHRoaXMuY29uZmlnLm9wdGlvbnMuZW5jcnlwdCAmJiAocHJlbG9naW5QYXlsb2FkLmVuY3J5cHRpb25TdHJpbmcgPT09ICdPTicgfHwgcHJlbG9naW5QYXlsb2FkLmVuY3J5cHRpb25TdHJpbmcgPT09ICdSRVEnKSkge1xuICAgICAgICAgIGlmICghdGhpcy5jb25maWcub3B0aW9ucy5lbmNyeXB0KSB7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnLCBuZXcgQ29ubmVjdGlvbkVycm9yKFwiU2VydmVyIHJlcXVpcmVzIGVuY3J5cHRpb24sIHNldCAnZW5jcnlwdCcgY29uZmlnIG9wdGlvbiB0byB0cnVlLlwiLCAnRUVOQ1JZUFQnKSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jbG9zZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLlNFTlRfVExTU1NMTkVHT1RJQVRJT04pO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5tZXNzYWdlSW8uc3RhcnRUbHModGhpcy5zZWN1cmVDb250ZXh0T3B0aW9ucywgdGhpcy5jb25maWcub3B0aW9ucy5zZXJ2ZXJOYW1lID8gdGhpcy5jb25maWcub3B0aW9ucy5zZXJ2ZXJOYW1lIDogdGhpcy5yb3V0aW5nRGF0YT8uc2VydmVyID8/IHRoaXMuY29uZmlnLnNlcnZlciwgdGhpcy5jb25maWcub3B0aW9ucy50cnVzdFNlcnZlckNlcnRpZmljYXRlKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc29ja2V0RXJyb3IoZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNlbmRMb2dpbjdQYWNrZXQoKTtcblxuICAgICAgICBjb25zdCB7IGF1dGhlbnRpY2F0aW9uIH0gPSB0aGlzLmNvbmZpZztcblxuICAgICAgICBzd2l0Y2ggKGF1dGhlbnRpY2F0aW9uLnR5cGUpIHtcbiAgICAgICAgICBjYXNlICd0b2tlbi1jcmVkZW50aWFsJzpcbiAgICAgICAgICBjYXNlICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LXBhc3N3b3JkJzpcbiAgICAgICAgICBjYXNlICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LW1zaS12bSc6XG4gICAgICAgICAgY2FzZSAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1tc2ktYXBwLXNlcnZpY2UnOlxuICAgICAgICAgIGNhc2UgJ2F6dXJlLWFjdGl2ZS1kaXJlY3Rvcnktc2VydmljZS1wcmluY2lwYWwtc2VjcmV0JzpcbiAgICAgICAgICBjYXNlICdhenVyZS1hY3RpdmUtZGlyZWN0b3J5LWRlZmF1bHQnOlxuICAgICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5TRU5UX0xPR0lON19XSVRIX0ZFREFVVEgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbnRsbSc6XG4gICAgICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLlNFTlRfTE9HSU43X1dJVEhfTlRMTSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5TRU5UX0xPR0lON19XSVRIX1NUQU5EQVJEX0xPR0lOKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9KSgpLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgZXZlbnRzOiB7XG4gICAgICBzb2NrZXRFcnJvcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuRklOQUwpO1xuICAgICAgfSxcbiAgICAgIGNvbm5lY3RUaW1lb3V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBSRVJPVVRJTkc6IHtcbiAgICBuYW1lOiAnUmVSb3V0aW5nJyxcbiAgICBlbnRlcjogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNsZWFudXBDb25uZWN0aW9uKENMRUFOVVBfVFlQRS5SRURJUkVDVCk7XG4gICAgfSxcbiAgICBldmVudHM6IHtcbiAgICAgIG1lc3NhZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgfSxcbiAgICAgIHNvY2tldEVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICB9LFxuICAgICAgY29ubmVjdFRpbWVvdXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgICAgIH0sXG4gICAgICByZWNvbm5lY3Q6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkNPTk5FQ1RJTkcpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgVFJBTlNJRU5UX0ZBSUxVUkVfUkVUUlk6IHtcbiAgICBuYW1lOiAnVFJBTlNJRU5UX0ZBSUxVUkVfUkVUUlknLFxuICAgIGVudGVyOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY3VyVHJhbnNpZW50UmV0cnlDb3VudCsrO1xuICAgICAgdGhpcy5jbGVhbnVwQ29ubmVjdGlvbihDTEVBTlVQX1RZUEUuUkVUUlkpO1xuICAgIH0sXG4gICAgZXZlbnRzOiB7XG4gICAgICBtZXNzYWdlOiBmdW5jdGlvbigpIHtcbiAgICAgIH0sXG4gICAgICBzb2NrZXRFcnJvcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuRklOQUwpO1xuICAgICAgfSxcbiAgICAgIGNvbm5lY3RUaW1lb3V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICB9LFxuICAgICAgcmV0cnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmNyZWF0ZVJldHJ5VGltZXIoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIFNFTlRfVExTU1NMTkVHT1RJQVRJT046IHtcbiAgICBuYW1lOiAnU2VudFRMU1NTTE5lZ290aWF0aW9uJyxcbiAgICBldmVudHM6IHtcbiAgICAgIHNvY2tldEVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICB9LFxuICAgICAgY29ubmVjdFRpbWVvdXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIFNFTlRfTE9HSU43X1dJVEhfU1RBTkRBUkRfTE9HSU46IHtcbiAgICBuYW1lOiAnU2VudExvZ2luN1dpdGhTdGFuZGFyZExvZ2luJyxcbiAgICBlbnRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBsZXQgbWVzc2FnZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtZXNzYWdlID0gYXdhaXQgdGhpcy5tZXNzYWdlSW8ucmVhZE1lc3NhZ2UoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zb2NrZXRFcnJvcihlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaGFuZGxlciA9IG5ldyBMb2dpbjdUb2tlbkhhbmRsZXIodGhpcyk7XG4gICAgICAgIGNvbnN0IHRva2VuU3RyZWFtUGFyc2VyID0gdGhpcy5jcmVhdGVUb2tlblN0cmVhbVBhcnNlcihtZXNzYWdlLCBoYW5kbGVyKTtcblxuICAgICAgICBhd2FpdCBvbmNlKHRva2VuU3RyZWFtUGFyc2VyLCAnZW5kJyk7XG5cbiAgICAgICAgaWYgKGhhbmRsZXIubG9naW5BY2tSZWNlaXZlZCkge1xuICAgICAgICAgIGlmIChoYW5kbGVyLnJvdXRpbmdEYXRhKSB7XG4gICAgICAgICAgICB0aGlzLnJvdXRpbmdEYXRhID0gaGFuZGxlci5yb3V0aW5nRGF0YTtcbiAgICAgICAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuUkVST1VUSU5HKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5MT0dHRURfSU5fU0VORElOR19JTklUSUFMX1NRTCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMubG9naW5FcnJvcikge1xuICAgICAgICAgIGlmIChpc1RyYW5zaWVudEVycm9yKHRoaXMubG9naW5FcnJvcikpIHtcbiAgICAgICAgICAgIHRoaXMuZGVidWcubG9nKCdJbml0aWF0aW5nIHJldHJ5IG9uIHRyYW5zaWVudCBlcnJvcicpO1xuICAgICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5UUkFOU0lFTlRfRkFJTFVSRV9SRVRSWSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY29ubmVjdCcsIHRoaXMubG9naW5FcnJvcik7XG4gICAgICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5lbWl0KCdjb25uZWN0JywgbmV3IENvbm5lY3Rpb25FcnJvcignTG9naW4gZmFpbGVkLicsICdFTE9HSU4nKSk7XG4gICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICAgIH1cbiAgICAgIH0pKCkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICBwcm9jZXNzLm5leHRUaWNrKCgpID0+IHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBldmVudHM6IHtcbiAgICAgIHNvY2tldEVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICB9LFxuICAgICAgY29ubmVjdFRpbWVvdXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIFNFTlRfTE9HSU43X1dJVEhfTlRMTToge1xuICAgIG5hbWU6ICdTZW50TG9naW43V2l0aE5UTE1Mb2dpbicsXG4gICAgZW50ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICBsZXQgbWVzc2FnZTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgbWVzc2FnZSA9IGF3YWl0IHRoaXMubWVzc2FnZUlvLnJlYWRNZXNzYWdlKCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNvY2tldEVycm9yKGVycik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgaGFuZGxlciA9IG5ldyBMb2dpbjdUb2tlbkhhbmRsZXIodGhpcyk7XG4gICAgICAgICAgY29uc3QgdG9rZW5TdHJlYW1QYXJzZXIgPSB0aGlzLmNyZWF0ZVRva2VuU3RyZWFtUGFyc2VyKG1lc3NhZ2UsIGhhbmRsZXIpO1xuXG4gICAgICAgICAgYXdhaXQgb25jZSh0b2tlblN0cmVhbVBhcnNlciwgJ2VuZCcpO1xuXG4gICAgICAgICAgaWYgKGhhbmRsZXIubG9naW5BY2tSZWNlaXZlZCkge1xuICAgICAgICAgICAgaWYgKGhhbmRsZXIucm91dGluZ0RhdGEpIHtcbiAgICAgICAgICAgICAgdGhpcy5yb3V0aW5nRGF0YSA9IGhhbmRsZXIucm91dGluZ0RhdGE7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLlJFUk9VVElORyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5MT0dHRURfSU5fU0VORElOR19JTklUSUFMX1NRTCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm50bG1wYWNrZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGF1dGhlbnRpY2F0aW9uID0gdGhpcy5jb25maWcuYXV0aGVudGljYXRpb24gYXMgTnRsbUF1dGhlbnRpY2F0aW9uO1xuXG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gbmV3IE5UTE1SZXNwb25zZVBheWxvYWQoe1xuICAgICAgICAgICAgICBkb21haW46IGF1dGhlbnRpY2F0aW9uLm9wdGlvbnMuZG9tYWluLFxuICAgICAgICAgICAgICB1c2VyTmFtZTogYXV0aGVudGljYXRpb24ub3B0aW9ucy51c2VyTmFtZSxcbiAgICAgICAgICAgICAgcGFzc3dvcmQ6IGF1dGhlbnRpY2F0aW9uLm9wdGlvbnMucGFzc3dvcmQsXG4gICAgICAgICAgICAgIG50bG1wYWNrZXQ6IHRoaXMubnRsbXBhY2tldFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMubWVzc2FnZUlvLnNlbmRNZXNzYWdlKFRZUEUuTlRMTUFVVEhfUEtULCBwYXlsb2FkLmRhdGEpO1xuICAgICAgICAgICAgdGhpcy5kZWJ1Zy5wYXlsb2FkKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICByZXR1cm4gcGF5bG9hZC50b1N0cmluZygnICAnKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLm50bG1wYWNrZXQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmxvZ2luRXJyb3IpIHtcbiAgICAgICAgICAgIGlmIChpc1RyYW5zaWVudEVycm9yKHRoaXMubG9naW5FcnJvcikpIHtcbiAgICAgICAgICAgICAgdGhpcy5kZWJ1Zy5sb2coJ0luaXRpYXRpbmcgcmV0cnkgb24gdHJhbnNpZW50IGVycm9yJyk7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLlRSQU5TSUVOVF9GQUlMVVJFX1JFVFJZKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuZW1pdCgnY29ubmVjdCcsIHRoaXMubG9naW5FcnJvcik7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdjb25uZWN0JywgbmV3IENvbm5lY3Rpb25FcnJvcignTG9naW4gZmFpbGVkLicsICdFTE9HSU4nKSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgIH0pKCkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICBwcm9jZXNzLm5leHRUaWNrKCgpID0+IHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBldmVudHM6IHtcbiAgICAgIHNvY2tldEVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICB9LFxuICAgICAgY29ubmVjdFRpbWVvdXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIFNFTlRfTE9HSU43X1dJVEhfRkVEQVVUSDoge1xuICAgIG5hbWU6ICdTZW50TG9naW43V2l0aGZlZGF1dGgnLFxuICAgIGVudGVyOiBmdW5jdGlvbigpIHtcbiAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGxldCBtZXNzYWdlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIG1lc3NhZ2UgPSBhd2FpdCB0aGlzLm1lc3NhZ2VJby5yZWFkTWVzc2FnZSgpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnNvY2tldEVycm9yKGVycik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYW5kbGVyID0gbmV3IExvZ2luN1Rva2VuSGFuZGxlcih0aGlzKTtcbiAgICAgICAgY29uc3QgdG9rZW5TdHJlYW1QYXJzZXIgPSB0aGlzLmNyZWF0ZVRva2VuU3RyZWFtUGFyc2VyKG1lc3NhZ2UsIGhhbmRsZXIpO1xuICAgICAgICBhd2FpdCBvbmNlKHRva2VuU3RyZWFtUGFyc2VyLCAnZW5kJyk7XG4gICAgICAgIGlmIChoYW5kbGVyLmxvZ2luQWNrUmVjZWl2ZWQpIHtcbiAgICAgICAgICBpZiAoaGFuZGxlci5yb3V0aW5nRGF0YSkge1xuICAgICAgICAgICAgdGhpcy5yb3V0aW5nRGF0YSA9IGhhbmRsZXIucm91dGluZ0RhdGE7XG4gICAgICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLlJFUk9VVElORyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuTE9HR0VEX0lOX1NFTkRJTkdfSU5JVElBTF9TUUwpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZlZEF1dGhJbmZvVG9rZW4gPSBoYW5kbGVyLmZlZEF1dGhJbmZvVG9rZW47XG5cbiAgICAgICAgaWYgKGZlZEF1dGhJbmZvVG9rZW4gJiYgZmVkQXV0aEluZm9Ub2tlbi5zdHN1cmwgJiYgZmVkQXV0aEluZm9Ub2tlbi5zcG4pIHtcbiAgICAgICAgICAvKiogRmVkZXJhdGVkIGF1dGhlbnRpY2F0aW9uIGNvbmZpZ2F0aW9uLiAqL1xuICAgICAgICAgIGNvbnN0IGF1dGhlbnRpY2F0aW9uID0gdGhpcy5jb25maWcuYXV0aGVudGljYXRpb24gYXMgVG9rZW5DcmVkZW50aWFsQXV0aGVudGljYXRpb24gfCBBenVyZUFjdGl2ZURpcmVjdG9yeVBhc3N3b3JkQXV0aGVudGljYXRpb24gfCBBenVyZUFjdGl2ZURpcmVjdG9yeU1zaVZtQXV0aGVudGljYXRpb24gfCBBenVyZUFjdGl2ZURpcmVjdG9yeU1zaUFwcFNlcnZpY2VBdXRoZW50aWNhdGlvbiB8IEF6dXJlQWN0aXZlRGlyZWN0b3J5U2VydmljZVByaW5jaXBhbFNlY3JldCB8IEF6dXJlQWN0aXZlRGlyZWN0b3J5RGVmYXVsdEF1dGhlbnRpY2F0aW9uO1xuICAgICAgICAgIC8qKiBQZXJtaXNzaW9uIHNjb3BlIHRvIHBhc3MgdG8gRW50cmEgSUQgd2hlbiByZXF1ZXN0aW5nIGFuIGF1dGhlbnRpY2F0aW9uIHRva2VuLiAqL1xuICAgICAgICAgIGNvbnN0IHRva2VuU2NvcGUgPSBuZXcgVVJMKCcvLmRlZmF1bHQnLCBmZWRBdXRoSW5mb1Rva2VuLnNwbikudG9TdHJpbmcoKTtcblxuICAgICAgICAgIC8qKiBJbnN0YW5jZSBvZiB0aGUgdG9rZW4gY3JlZGVudGlhbCB0byB1c2UgdG8gYXV0aGVudGljYXRlIHRvIHRoZSByZXNvdXJjZS4gKi9cbiAgICAgICAgICBsZXQgY3JlZGVudGlhbHM6IFRva2VuQ3JlZGVudGlhbDtcblxuICAgICAgICAgIHN3aXRjaCAoYXV0aGVudGljYXRpb24udHlwZSkge1xuICAgICAgICAgICAgY2FzZSAndG9rZW4tY3JlZGVudGlhbCc6XG4gICAgICAgICAgICAgIGNyZWRlbnRpYWxzID0gYXV0aGVudGljYXRpb24ub3B0aW9ucy5jcmVkZW50aWFsO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktcGFzc3dvcmQnOlxuICAgICAgICAgICAgICBjcmVkZW50aWFscyA9IG5ldyBVc2VybmFtZVBhc3N3b3JkQ3JlZGVudGlhbChcbiAgICAgICAgICAgICAgICBhdXRoZW50aWNhdGlvbi5vcHRpb25zLnRlbmFudElkID8/ICdjb21tb24nLFxuICAgICAgICAgICAgICAgIGF1dGhlbnRpY2F0aW9uLm9wdGlvbnMuY2xpZW50SWQsXG4gICAgICAgICAgICAgICAgYXV0aGVudGljYXRpb24ub3B0aW9ucy51c2VyTmFtZSxcbiAgICAgICAgICAgICAgICBhdXRoZW50aWNhdGlvbi5vcHRpb25zLnBhc3N3b3JkXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1tc2ktdm0nOlxuICAgICAgICAgICAgY2FzZSAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1tc2ktYXBwLXNlcnZpY2UnOlxuICAgICAgICAgICAgICBjb25zdCBtc2lBcmdzID0gYXV0aGVudGljYXRpb24ub3B0aW9ucy5jbGllbnRJZCA/IFthdXRoZW50aWNhdGlvbi5vcHRpb25zLmNsaWVudElkLCB7fV0gOiBbe31dO1xuICAgICAgICAgICAgICBjcmVkZW50aWFscyA9IG5ldyBNYW5hZ2VkSWRlbnRpdHlDcmVkZW50aWFsKC4uLm1zaUFyZ3MpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2F6dXJlLWFjdGl2ZS1kaXJlY3RvcnktZGVmYXVsdCc6XG4gICAgICAgICAgICAgIGNvbnN0IGFyZ3MgPSBhdXRoZW50aWNhdGlvbi5vcHRpb25zLmNsaWVudElkID8geyBtYW5hZ2VkSWRlbnRpdHlDbGllbnRJZDogYXV0aGVudGljYXRpb24ub3B0aW9ucy5jbGllbnRJZCB9IDoge307XG4gICAgICAgICAgICAgIGNyZWRlbnRpYWxzID0gbmV3IERlZmF1bHRBenVyZUNyZWRlbnRpYWwoYXJncyk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnYXp1cmUtYWN0aXZlLWRpcmVjdG9yeS1zZXJ2aWNlLXByaW5jaXBhbC1zZWNyZXQnOlxuICAgICAgICAgICAgICBjcmVkZW50aWFscyA9IG5ldyBDbGllbnRTZWNyZXRDcmVkZW50aWFsKFxuICAgICAgICAgICAgICAgIGF1dGhlbnRpY2F0aW9uLm9wdGlvbnMudGVuYW50SWQsXG4gICAgICAgICAgICAgICAgYXV0aGVudGljYXRpb24ub3B0aW9ucy5jbGllbnRJZCxcbiAgICAgICAgICAgICAgICBhdXRoZW50aWNhdGlvbi5vcHRpb25zLmNsaWVudFNlY3JldFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvKiogQWNjZXNzIHRva2VuIHJldHJpZXZlZCBmcm9tIEVudHJhIElEIGZvciB0aGUgY29uZmlndXJlZCBwZXJtaXNzaW9uIHNjb3BlKHMpLiAqL1xuICAgICAgICAgIGxldCB0b2tlblJlc3BvbnNlOiBBY2Nlc3NUb2tlbiB8IG51bGw7XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdG9rZW5SZXNwb25zZSA9IGF3YWl0IGNyZWRlbnRpYWxzLmdldFRva2VuKHRva2VuU2NvcGUpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgdGhpcy5sb2dpbkVycm9yID0gbmV3IEFnZ3JlZ2F0ZUVycm9yKFxuICAgICAgICAgICAgICBbbmV3IENvbm5lY3Rpb25FcnJvcignU2VjdXJpdHkgdG9rZW4gY291bGQgbm90IGJlIGF1dGhlbnRpY2F0ZWQgb3IgYXV0aG9yaXplZC4nLCAnRUZFREFVVEgnKSwgZXJyXSk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnLCB0aGlzLmxvZ2luRXJyb3IpO1xuICAgICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVHlwZSBndWFyZCB0aGUgdG9rZW4gdmFsdWUgc28gdGhhdCBpdCBpcyBuZXZlciBudWxsLlxuICAgICAgICAgIGlmICh0b2tlblJlc3BvbnNlID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmxvZ2luRXJyb3IgPSBuZXcgQWdncmVnYXRlRXJyb3IoXG4gICAgICAgICAgICAgIFtuZXcgQ29ubmVjdGlvbkVycm9yKCdTZWN1cml0eSB0b2tlbiBjb3VsZCBub3QgYmUgYXV0aGVudGljYXRlZCBvciBhdXRob3JpemVkLicsICdFRkVEQVVUSCcpXSk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnLCB0aGlzLmxvZ2luRXJyb3IpO1xuICAgICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5zZW5kRmVkQXV0aFRva2VuTWVzc2FnZSh0b2tlblJlc3BvbnNlLnRva2VuKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMubG9naW5FcnJvcikge1xuICAgICAgICAgIGlmIChpc1RyYW5zaWVudEVycm9yKHRoaXMubG9naW5FcnJvcikpIHtcbiAgICAgICAgICAgIHRoaXMuZGVidWcubG9nKCdJbml0aWF0aW5nIHJldHJ5IG9uIHRyYW5zaWVudCBlcnJvcicpO1xuICAgICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5UUkFOU0lFTlRfRkFJTFVSRV9SRVRSWSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY29ubmVjdCcsIHRoaXMubG9naW5FcnJvcik7XG4gICAgICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5lbWl0KCdjb25uZWN0JywgbmV3IENvbm5lY3Rpb25FcnJvcignTG9naW4gZmFpbGVkLicsICdFTE9HSU4nKSk7XG4gICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICAgIH1cblxuICAgICAgfSkoKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4ge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGV2ZW50czoge1xuICAgICAgc29ja2V0RXJyb3I6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgICAgIH0sXG4gICAgICBjb25uZWN0VGltZW91dDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuRklOQUwpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgTE9HR0VEX0lOX1NFTkRJTkdfSU5JVElBTF9TUUw6IHtcbiAgICBuYW1lOiAnTG9nZ2VkSW5TZW5kaW5nSW5pdGlhbFNxbCcsXG4gICAgZW50ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5zZW5kSW5pdGlhbFNxbCgpO1xuICAgICAgICBsZXQgbWVzc2FnZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtZXNzYWdlID0gYXdhaXQgdGhpcy5tZXNzYWdlSW8ucmVhZE1lc3NhZ2UoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zb2NrZXRFcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRva2VuU3RyZWFtUGFyc2VyID0gdGhpcy5jcmVhdGVUb2tlblN0cmVhbVBhcnNlcihtZXNzYWdlLCBuZXcgSW5pdGlhbFNxbFRva2VuSGFuZGxlcih0aGlzKSk7XG4gICAgICAgIGF3YWl0IG9uY2UodG9rZW5TdHJlYW1QYXJzZXIsICdlbmQnKTtcblxuICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkxPR0dFRF9JTik7XG4gICAgICAgIHRoaXMucHJvY2Vzc2VkSW5pdGlhbFNxbCgpO1xuXG4gICAgICB9KSgpLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgZXZlbnRzOiB7XG4gICAgICBzb2NrZXRFcnJvcjogZnVuY3Rpb24gc29ja2V0RXJyb3IoKSB7XG4gICAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuRklOQUwpO1xuICAgICAgfSxcbiAgICAgIGNvbm5lY3RUaW1lb3V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5GSU5BTCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBMT0dHRURfSU46IHtcbiAgICBuYW1lOiAnTG9nZ2VkSW4nLFxuICAgIGV2ZW50czoge1xuICAgICAgc29ja2V0RXJyb3I6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIFNFTlRfQ0xJRU5UX1JFUVVFU1Q6IHtcbiAgICBuYW1lOiAnU2VudENsaWVudFJlcXVlc3QnLFxuICAgIGVudGVyOiBmdW5jdGlvbigpIHtcbiAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGxldCBtZXNzYWdlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIG1lc3NhZ2UgPSBhd2FpdCB0aGlzLm1lc3NhZ2VJby5yZWFkTWVzc2FnZSgpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnNvY2tldEVycm9yKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVxdWVzdCB0aW1lciBpcyBzdG9wcGVkIG9uIGZpcnN0IGRhdGEgcGFja2FnZVxuICAgICAgICB0aGlzLmNsZWFyUmVxdWVzdFRpbWVyKCk7XG5cbiAgICAgICAgY29uc3QgdG9rZW5TdHJlYW1QYXJzZXIgPSB0aGlzLmNyZWF0ZVRva2VuU3RyZWFtUGFyc2VyKG1lc3NhZ2UsIG5ldyBSZXF1ZXN0VG9rZW5IYW5kbGVyKHRoaXMsIHRoaXMucmVxdWVzdCEpKTtcblxuICAgICAgICAvLyBJZiB0aGUgcmVxdWVzdCB3YXMgY2FuY2VsZWQgYW5kIHdlIGhhdmUgYSBgY2FuY2VsVGltZXJgXG4gICAgICAgIC8vIGRlZmluZWQsIHdlIHNlbmQgYSBhdHRlbnRpb24gbWVzc2FnZSBhZnRlciB0aGVcbiAgICAgICAgLy8gcmVxdWVzdCBtZXNzYWdlIHdhcyBmdWxseSBzZW50IG9mZi5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gV2UgYWxyZWFkeSBzdGFydGVkIGNvbnN1bWluZyB0aGUgY3VycmVudCBtZXNzYWdlXG4gICAgICAgIC8vIChidXQgYWxsIHRoZSB0b2tlbiBoYW5kbGVycyBzaG91bGQgYmUgbm8tb3BzKSwgYW5kXG4gICAgICAgIC8vIG5lZWQgdG8gZW5zdXJlIHRoZSBuZXh0IG1lc3NhZ2UgaXMgaGFuZGxlZCBieSB0aGVcbiAgICAgICAgLy8gYFNFTlRfQVRURU5USU9OYCBzdGF0ZS5cbiAgICAgICAgaWYgKHRoaXMucmVxdWVzdD8uY2FuY2VsZWQgJiYgdGhpcy5jYW5jZWxUaW1lcikge1xuICAgICAgICAgIHJldHVybiB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLlNFTlRfQVRURU5USU9OKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9uUmVzdW1lID0gKCkgPT4ge1xuICAgICAgICAgIHRva2VuU3RyZWFtUGFyc2VyLnJlc3VtZSgpO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBvblBhdXNlID0gKCkgPT4ge1xuICAgICAgICAgIHRva2VuU3RyZWFtUGFyc2VyLnBhdXNlKCk7XG5cbiAgICAgICAgICB0aGlzLnJlcXVlc3Q/Lm9uY2UoJ3Jlc3VtZScsIG9uUmVzdW1lKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLnJlcXVlc3Q/Lm9uKCdwYXVzZScsIG9uUGF1c2UpO1xuXG4gICAgICAgIGlmICh0aGlzLnJlcXVlc3QgaW5zdGFuY2VvZiBSZXF1ZXN0ICYmIHRoaXMucmVxdWVzdC5wYXVzZWQpIHtcbiAgICAgICAgICBvblBhdXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvbkNhbmNlbCA9ICgpID0+IHtcbiAgICAgICAgICB0b2tlblN0cmVhbVBhcnNlci5yZW1vdmVMaXN0ZW5lcignZW5kJywgb25FbmRPZk1lc3NhZ2UpO1xuXG4gICAgICAgICAgaWYgKHRoaXMucmVxdWVzdCBpbnN0YW5jZW9mIFJlcXVlc3QgJiYgdGhpcy5yZXF1ZXN0LnBhdXNlZCkge1xuICAgICAgICAgICAgLy8gcmVzdW1lIHRoZSByZXF1ZXN0IGlmIGl0IHdhcyBwYXVzZWQgc28gd2UgY2FuIHJlYWQgdGhlIHJlbWFpbmluZyB0b2tlbnNcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdC5yZXN1bWUoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLnJlcXVlc3Q/LnJlbW92ZUxpc3RlbmVyKCdwYXVzZScsIG9uUGF1c2UpO1xuICAgICAgICAgIHRoaXMucmVxdWVzdD8ucmVtb3ZlTGlzdGVuZXIoJ3Jlc3VtZScsIG9uUmVzdW1lKTtcblxuICAgICAgICAgIC8vIFRoZSBgX2NhbmNlbEFmdGVyUmVxdWVzdFNlbnRgIGNhbGxiYWNrIHdpbGwgaGF2ZSBzZW50IGFcbiAgICAgICAgICAvLyBhdHRlbnRpb24gbWVzc2FnZSwgc28gbm93IHdlIG5lZWQgdG8gYWxzbyBzd2l0Y2ggdG9cbiAgICAgICAgICAvLyB0aGUgYFNFTlRfQVRURU5USU9OYCBzdGF0ZSB0byBtYWtlIHN1cmUgdGhlIGF0dGVudGlvbiBhY2tcbiAgICAgICAgICAvLyBtZXNzYWdlIGlzIHByb2Nlc3NlZCBjb3JyZWN0bHkuXG4gICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5TRU5UX0FUVEVOVElPTik7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3Qgb25FbmRPZk1lc3NhZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5yZXF1ZXN0Py5yZW1vdmVMaXN0ZW5lcignY2FuY2VsJywgdGhpcy5fY2FuY2VsQWZ0ZXJSZXF1ZXN0U2VudCk7XG4gICAgICAgICAgdGhpcy5yZXF1ZXN0Py5yZW1vdmVMaXN0ZW5lcignY2FuY2VsJywgb25DYW5jZWwpO1xuICAgICAgICAgIHRoaXMucmVxdWVzdD8ucmVtb3ZlTGlzdGVuZXIoJ3BhdXNlJywgb25QYXVzZSk7XG4gICAgICAgICAgdGhpcy5yZXF1ZXN0Py5yZW1vdmVMaXN0ZW5lcigncmVzdW1lJywgb25SZXN1bWUpO1xuXG4gICAgICAgICAgdGhpcy50cmFuc2l0aW9uVG8odGhpcy5TVEFURS5MT0dHRURfSU4pO1xuICAgICAgICAgIGNvbnN0IHNxbFJlcXVlc3QgPSB0aGlzLnJlcXVlc3QgYXMgUmVxdWVzdDtcbiAgICAgICAgICB0aGlzLnJlcXVlc3QgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgaWYgKHRoaXMuY29uZmlnLm9wdGlvbnMudGRzVmVyc2lvbiA8ICc3XzInICYmIHNxbFJlcXVlc3QuZXJyb3IgJiYgdGhpcy5pc1NxbEJhdGNoKSB7XG4gICAgICAgICAgICB0aGlzLmluVHJhbnNhY3Rpb24gPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3FsUmVxdWVzdC5jYWxsYmFjayhzcWxSZXF1ZXN0LmVycm9yLCBzcWxSZXF1ZXN0LnJvd0NvdW50LCBzcWxSZXF1ZXN0LnJvd3MpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRva2VuU3RyZWFtUGFyc2VyLm9uY2UoJ2VuZCcsIG9uRW5kT2ZNZXNzYWdlKTtcbiAgICAgICAgdGhpcy5yZXF1ZXN0Py5vbmNlKCdjYW5jZWwnLCBvbkNhbmNlbCk7XG4gICAgICB9KSgpO1xuXG4gICAgfSxcbiAgICBleGl0OiBmdW5jdGlvbihuZXh0U3RhdGUpIHtcbiAgICAgIHRoaXMuY2xlYXJSZXF1ZXN0VGltZXIoKTtcbiAgICB9LFxuICAgIGV2ZW50czoge1xuICAgICAgc29ja2V0RXJyb3I6IGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjb25zdCBzcWxSZXF1ZXN0ID0gdGhpcy5yZXF1ZXN0ITtcbiAgICAgICAgdGhpcy5yZXF1ZXN0ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkZJTkFMKTtcblxuICAgICAgICBzcWxSZXF1ZXN0LmNhbGxiYWNrKGVycik7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBTRU5UX0FUVEVOVElPTjoge1xuICAgIG5hbWU6ICdTZW50QXR0ZW50aW9uJyxcbiAgICBlbnRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBsZXQgbWVzc2FnZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtZXNzYWdlID0gYXdhaXQgdGhpcy5tZXNzYWdlSW8ucmVhZE1lc3NhZ2UoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zb2NrZXRFcnJvcihlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaGFuZGxlciA9IG5ldyBBdHRlbnRpb25Ub2tlbkhhbmRsZXIodGhpcywgdGhpcy5yZXF1ZXN0ISk7XG4gICAgICAgIGNvbnN0IHRva2VuU3RyZWFtUGFyc2VyID0gdGhpcy5jcmVhdGVUb2tlblN0cmVhbVBhcnNlcihtZXNzYWdlLCBoYW5kbGVyKTtcblxuICAgICAgICBhd2FpdCBvbmNlKHRva2VuU3RyZWFtUGFyc2VyLCAnZW5kJyk7XG4gICAgICAgIC8vIDMuMi41LjcgU2VudCBBdHRlbnRpb24gU3RhdGVcbiAgICAgICAgLy8gRGlzY2FyZCBhbnkgZGF0YSBjb250YWluZWQgaW4gdGhlIHJlc3BvbnNlLCB1bnRpbCB3ZSByZWNlaXZlIHRoZSBhdHRlbnRpb24gcmVzcG9uc2VcbiAgICAgICAgaWYgKGhhbmRsZXIuYXR0ZW50aW9uUmVjZWl2ZWQpIHtcbiAgICAgICAgICB0aGlzLmNsZWFyQ2FuY2VsVGltZXIoKTtcblxuICAgICAgICAgIGNvbnN0IHNxbFJlcXVlc3QgPSB0aGlzLnJlcXVlc3QhO1xuICAgICAgICAgIHRoaXMucmVxdWVzdCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB0aGlzLnRyYW5zaXRpb25Ubyh0aGlzLlNUQVRFLkxPR0dFRF9JTik7XG5cbiAgICAgICAgICBpZiAoc3FsUmVxdWVzdC5lcnJvciAmJiBzcWxSZXF1ZXN0LmVycm9yIGluc3RhbmNlb2YgUmVxdWVzdEVycm9yICYmIHNxbFJlcXVlc3QuZXJyb3IuY29kZSA9PT0gJ0VUSU1FT1VUJykge1xuICAgICAgICAgICAgc3FsUmVxdWVzdC5jYWxsYmFjayhzcWxSZXF1ZXN0LmVycm9yKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3FsUmVxdWVzdC5jYWxsYmFjayhuZXcgUmVxdWVzdEVycm9yKCdDYW5jZWxlZC4nLCAnRUNBTkNFTCcpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgfSkoKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4ge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGV2ZW50czoge1xuICAgICAgc29ja2V0RXJyb3I6IGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjb25zdCBzcWxSZXF1ZXN0ID0gdGhpcy5yZXF1ZXN0ITtcbiAgICAgICAgdGhpcy5yZXF1ZXN0ID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHRoaXMudHJhbnNpdGlvblRvKHRoaXMuU1RBVEUuRklOQUwpO1xuXG4gICAgICAgIHNxbFJlcXVlc3QuY2FsbGJhY2soZXJyKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIEZJTkFMOiB7XG4gICAgbmFtZTogJ0ZpbmFsJyxcbiAgICBlbnRlcjogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNsZWFudXBDb25uZWN0aW9uKENMRUFOVVBfVFlQRS5OT1JNQUwpO1xuICAgIH0sXG4gICAgZXZlbnRzOiB7XG4gICAgICBjb25uZWN0VGltZW91dDogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIERvIG5vdGhpbmcsIGFzIHRoZSB0aW1lciBzaG91bGQgYmUgY2xlYW5lZCB1cC5cbiAgICAgIH0sXG4gICAgICBtZXNzYWdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gRG8gbm90aGluZ1xuICAgICAgfSxcbiAgICAgIHNvY2tldEVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gRG8gbm90aGluZ1xu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