"use strict";
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
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertCommand = void 0;
var types_1 = require("./types");
var errors_1 = require("../errors");
var validateProperties_1 = require("../utils/validateProperties");
var UpsertCommand = /** @class */ (function () {
    function UpsertCommand(apiProvider, namespace) {
        this.validator = function (records) {
            for (var _i = 0, records_1 = records; _i < records_1.length; _i++) {
                var record = records_1[_i];
                (0, validateProperties_1.ValidateProperties)(record, types_1.PineconeRecordsProperties);
            }
            if (records.length === 0) {
                throw new errors_1.PineconeArgumentError('Must pass in at least 1 record to upsert.');
            }
            records.forEach(function (record) {
                if (!record.id) {
                    throw new errors_1.PineconeArgumentError('Every record must include an `id` property in order to upsert.');
                }
                if (!record.values) {
                    throw new errors_1.PineconeArgumentError('Every record must include a `values` property in order to upsert.');
                }
            });
        };
        this.apiProvider = apiProvider;
        this.namespace = namespace;
    }
    UpsertCommand.prototype.run = function (records) {
        return __awaiter(this, void 0, void 0, function () {
            var api;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.validator(records);
                        return [4 /*yield*/, this.apiProvider.provide()];
                    case 1:
                        api = _a.sent();
                        return [4 /*yield*/, api.upsert({
                                upsertRequest: {
                                    vectors: records,
                                    namespace: this.namespace,
                                },
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return UpsertCommand;
}());
exports.UpsertCommand = UpsertCommand;
//# sourceMappingURL=upsert.js.map