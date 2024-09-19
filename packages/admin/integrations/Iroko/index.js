'use strict';
var __extends =
  (this && this.__extends) ||
  (function () {
    var extendStatics = function (d, b) {
      extendStatics =
        Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array &&
          function (d, b) {
            d.__proto__ = b;
          }) ||
        function (d, b) {
          for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
      return extendStatics(d, b);
    };
    return function (d, b) {
      if (typeof b !== 'function' && b !== null)
        throw new TypeError('Class extends value ' + String(b) + ' is not a constructor or null');
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.IrokoIntegration = void 0;
var core_1 = require('@kpl/core');
var IrokoIntegration = /** @class */ (function (_super) {
  __extends(IrokoIntegration, _super);
  function IrokoIntegration(_a) {
    var config = _a.config;
    return (
      _super.call(this, {
        name: 'Iroko',
        logoUrl: 'https://iroko.tv/favicon.ico',
      }) || this
    );
  }
  IrokoIntegration.prototype.getAuthenticator = function () {
    return new core_1.IntegrationAuth({
      // @ts-ignore
      onConnectionCreated: function () {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: core_1.IntegrationCredentialType.OAUTH,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: 'https://app.asana.com',
        AUTHORIZATION_ENDPOINT: '/-/oauth_authorize',
        TOKEN_ENDPOINT: '/-/oauth_token',
        SCOPES: [],
      },
      dataAccess: this.dataLayer,
    });
  };
  return IrokoIntegration;
})(core_1.Integration);
exports.IrokoIntegration = IrokoIntegration;
