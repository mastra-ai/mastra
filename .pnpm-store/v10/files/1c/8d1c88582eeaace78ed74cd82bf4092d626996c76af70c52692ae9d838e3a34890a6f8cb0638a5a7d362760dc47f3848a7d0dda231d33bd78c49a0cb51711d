"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _http = _interopRequireDefault(require("http"));

var _https = _interopRequireDefault(require("https"));

var _boolean = require("boolean");

var _semver = _interopRequireDefault(require("semver"));

var _Logger = _interopRequireDefault(require("../Logger"));

var _classes = require("../classes");

var _errors = require("../errors");

var _utilities = require("../utilities");

var _createProxyController = _interopRequireDefault(require("./createProxyController"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const httpGet = _http.default.get;
const httpRequest = _http.default.request;
const httpsGet = _https.default.get;
const httpsRequest = _https.default.request;

const log = _Logger.default.child({
  namespace: 'createGlobalProxyAgent'
});

const defaultConfigurationInput = {
  environmentVariableNamespace: undefined,
  forceGlobalAgent: undefined,
  socketConnectionTimeout: 60000
};

const omitUndefined = subject => {
  const keys = Object.keys(subject);
  const result = {};

  for (const key of keys) {
    const value = subject[key];

    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
};

const createConfiguration = configurationInput => {
  // eslint-disable-next-line no-process-env
  const environment = process.env;
  const defaultConfiguration = {
    environmentVariableNamespace: typeof environment.GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE === 'string' ? environment.GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE : 'GLOBAL_AGENT_',
    forceGlobalAgent: typeof environment.GLOBAL_AGENT_FORCE_GLOBAL_AGENT === 'string' ? (0, _boolean.boolean)(environment.GLOBAL_AGENT_FORCE_GLOBAL_AGENT) : true,
    socketConnectionTimeout: typeof environment.GLOBAL_AGENT_SOCKET_CONNECTION_TIMEOUT === 'string' ? Number.parseInt(environment.GLOBAL_AGENT_SOCKET_CONNECTION_TIMEOUT, 10) : defaultConfigurationInput.socketConnectionTimeout
  }; // $FlowFixMe

  return { ...defaultConfiguration,
    ...omitUndefined(configurationInput)
  };
};

const createGlobalProxyAgent = (configurationInput = defaultConfigurationInput) => {
  const configuration = createConfiguration(configurationInput);
  const proxyController = (0, _createProxyController.default)(); // eslint-disable-next-line no-process-env

  proxyController.HTTP_PROXY = process.env[configuration.environmentVariableNamespace + 'HTTP_PROXY'] || null; // eslint-disable-next-line no-process-env

  proxyController.HTTPS_PROXY = process.env[configuration.environmentVariableNamespace + 'HTTPS_PROXY'] || null; // eslint-disable-next-line no-process-env

  proxyController.NO_PROXY = process.env[configuration.environmentVariableNamespace + 'NO_PROXY'] || null;
  log.info({
    configuration,
    state: proxyController
  }, 'global agent has been initialized');

  const mustUrlUseProxy = getProxy => {
    return url => {
      if (!getProxy()) {
        return false;
      }

      if (!proxyController.NO_PROXY) {
        return true;
      }

      return !(0, _utilities.isUrlMatchingNoProxy)(url, proxyController.NO_PROXY);
    };
  };

  const getUrlProxy = getProxy => {
    return () => {
      const proxy = getProxy();

      if (!proxy) {
        throw new _errors.UnexpectedStateError('HTTP(S) proxy must be configured.');
      }

      return (0, _utilities.parseProxyUrl)(proxy);
    };
  };

  const getHttpProxy = () => {
    return proxyController.HTTP_PROXY;
  };

  const BoundHttpProxyAgent = class extends _classes.HttpProxyAgent {
    constructor() {
      super(() => {
        return getHttpProxy();
      }, mustUrlUseProxy(getHttpProxy), getUrlProxy(getHttpProxy), _http.default.globalAgent, configuration.socketConnectionTimeout);
    }

  };
  const httpAgent = new BoundHttpProxyAgent();

  const getHttpsProxy = () => {
    return proxyController.HTTPS_PROXY || proxyController.HTTP_PROXY;
  };

  const BoundHttpsProxyAgent = class extends _classes.HttpsProxyAgent {
    constructor() {
      super(() => {
        return getHttpsProxy();
      }, mustUrlUseProxy(getHttpsProxy), getUrlProxy(getHttpsProxy), _https.default.globalAgent, configuration.socketConnectionTimeout);
    }

  };
  const httpsAgent = new BoundHttpsProxyAgent(); // Overriding globalAgent was added in v11.7.
  // @see https://nodejs.org/uk/blog/release/v11.7.0/

  if (_semver.default.gte(process.version, 'v11.7.0')) {
    // @see https://github.com/facebook/flow/issues/7670
    // $FlowFixMe
    _http.default.globalAgent = httpAgent; // $FlowFixMe

    _https.default.globalAgent = httpsAgent;
  } // The reason this logic is used in addition to overriding http(s).globalAgent
  // is because there is no guarantee that we set http(s).globalAgent variable
  // before an instance of http(s).Agent has been already constructed by someone,
  // e.g. Stripe SDK creates instances of http(s).Agent at the top-level.
  // @see https://github.com/gajus/global-agent/pull/13
  //
  // We still want to override http(s).globalAgent when possible to enable logic
  // in `bindHttpMethod`.


  if (_semver.default.gte(process.version, 'v10.0.0')) {
    // $FlowFixMe
    _http.default.get = (0, _utilities.bindHttpMethod)(httpGet, httpAgent, configuration.forceGlobalAgent); // $FlowFixMe

    _http.default.request = (0, _utilities.bindHttpMethod)(httpRequest, httpAgent, configuration.forceGlobalAgent); // $FlowFixMe

    _https.default.get = (0, _utilities.bindHttpMethod)(httpsGet, httpsAgent, configuration.forceGlobalAgent); // $FlowFixMe

    _https.default.request = (0, _utilities.bindHttpMethod)(httpsRequest, httpsAgent, configuration.forceGlobalAgent);
  } else {
    log.warn('attempt to initialize global-agent in unsupported Node.js version was ignored');
  }

  return proxyController;
};

var _default = createGlobalProxyAgent;
exports.default = _default;
//# sourceMappingURL=createGlobalProxyAgent.js.map