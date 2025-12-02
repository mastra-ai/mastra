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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = stream;
const command_exists_1 = __importDefault(require("command-exists"));
const ElevenLabsError_1 = require("../errors/ElevenLabsError");
const runtime_1 = require("../core/runtime/runtime");
const execa_1 = __importDefault(require("execa"));
function stream(audio) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, audio_1, audio_1_1;
        var _b, e_1, _c, _d;
        var _e, _f;
        if (runtime_1.RUNTIME.type !== "node") {
            throw new ElevenLabsError_1.ElevenLabsError({
                message: `This function is only supported in node environments. ${runtime_1.RUNTIME.type} is not supported`,
            });
        }
        if (!(0, command_exists_1.default)("mpv")) {
            throw new ElevenLabsError_1.ElevenLabsError({
                message: `mpv not found, necessary to stream audio."
            On mac you can install it with 'brew install mpv'.
            On linux and windows you can install it from https://mpv.io/`,
            });
        }
        const mpv = (0, execa_1.default)("mpv", ["--no-cache", "--no-terminal", "--", "fd://0"]);
        try {
            for (_a = true, audio_1 = __asyncValues(audio); audio_1_1 = yield audio_1.next(), _b = audio_1_1.done, !_b; _a = true) {
                _d = audio_1_1.value;
                _a = false;
                const data = _d;
                (_e = mpv.stdin) === null || _e === void 0 ? void 0 : _e.write(data);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_a && !_b && (_c = audio_1.return)) yield _c.call(audio_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        (_f = mpv.stdin) === null || _f === void 0 ? void 0 : _f.end();
        yield mpv;
    });
}
