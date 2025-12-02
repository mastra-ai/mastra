/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { context, diag } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import { Resource, } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, } from '@opentelemetry/semantic-conventions';
import { ATTR_CLOUD_PROVIDER, ATTR_CLOUD_PLATFORM, ATTR_SERVICE_NAMESPACE, ATTR_SERVICE_INSTANCE_ID, CLOUD_PROVIDER_VALUE_AWS, CLOUD_PLATFORM_VALUE_AWS_ELASTIC_BEANSTALK, } from '../semconv';
import * as fs from 'fs';
import * as util from 'util';
/**
 * The AwsBeanstalkDetector can be used to detect if a process is running in AWS Elastic
 * Beanstalk and return a {@link Resource} populated with data about the beanstalk
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 *
 * See https://docs.amazonaws.cn/en_us/xray/latest/devguide/xray-guide.pdf
 * for more details about detecting information of Elastic Beanstalk plugins
 */
var DEFAULT_BEANSTALK_CONF_PATH = '/var/elasticbeanstalk/xray/environment.conf';
var WIN_OS_BEANSTALK_CONF_PATH = 'C:\\Program Files\\Amazon\\XRay\\environment.conf';
var AwsBeanstalkDetectorSync = /** @class */ (function () {
    function AwsBeanstalkDetectorSync() {
        if (process.platform === 'win32') {
            this.BEANSTALK_CONF_PATH = WIN_OS_BEANSTALK_CONF_PATH;
        }
        else {
            this.BEANSTALK_CONF_PATH = DEFAULT_BEANSTALK_CONF_PATH;
        }
    }
    AwsBeanstalkDetectorSync.prototype.detect = function (config) {
        var _this = this;
        var attributes = context.with(suppressTracing(context.active()), function () {
            return _this._getAttributes();
        });
        return new Resource({}, attributes);
    };
    /**
     * Attempts to obtain AWS Beanstalk configuration from the file
     * system. If file is accesible and read succesfully it returns
     * a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the file is not accesible or
     * fails in the reading process.
     */
    AwsBeanstalkDetectorSync.prototype._getAttributes = function (_config) {
        return __awaiter(this, void 0, void 0, function () {
            var rawData, parsedData, e_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, AwsBeanstalkDetectorSync.fileAccessAsync(this.BEANSTALK_CONF_PATH, fs.constants.R_OK)];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, AwsBeanstalkDetectorSync.readFileAsync(this.BEANSTALK_CONF_PATH, 'utf8')];
                    case 2:
                        rawData = _b.sent();
                        parsedData = JSON.parse(rawData);
                        return [2 /*return*/, (_a = {},
                                _a[ATTR_CLOUD_PROVIDER] = CLOUD_PROVIDER_VALUE_AWS,
                                _a[ATTR_CLOUD_PLATFORM] = CLOUD_PLATFORM_VALUE_AWS_ELASTIC_BEANSTALK,
                                _a[ATTR_SERVICE_NAME] = CLOUD_PLATFORM_VALUE_AWS_ELASTIC_BEANSTALK,
                                _a[ATTR_SERVICE_NAMESPACE] = parsedData.environment_name,
                                _a[ATTR_SERVICE_VERSION] = parsedData.version_label,
                                _a[ATTR_SERVICE_INSTANCE_ID] = parsedData.deployment_id,
                                _a)];
                    case 3:
                        e_1 = _b.sent();
                        diag.debug("AwsBeanstalkDetectorSync failed: " + e_1.message);
                        return [2 /*return*/, {}];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    AwsBeanstalkDetectorSync.readFileAsync = util.promisify(fs.readFile);
    AwsBeanstalkDetectorSync.fileAccessAsync = util.promisify(fs.access);
    return AwsBeanstalkDetectorSync;
}());
export { AwsBeanstalkDetectorSync };
export var awsBeanstalkDetectorSync = new AwsBeanstalkDetectorSync();
//# sourceMappingURL=AwsBeanstalkDetectorSync.js.map