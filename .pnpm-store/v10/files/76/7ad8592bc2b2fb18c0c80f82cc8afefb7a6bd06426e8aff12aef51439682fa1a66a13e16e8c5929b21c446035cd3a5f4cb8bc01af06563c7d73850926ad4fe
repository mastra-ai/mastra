"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElevenLabsClient = void 0;
const Client_1 = require("../Client");
const errors = __importStar(require("../errors"));
class ElevenLabsClient extends Client_1.ElevenLabsClient {
    constructor(options = {}) {
        var _a;
        const apiKey = (_a = options.apiKey) !== null && _a !== void 0 ? _a : process.env["ELEVENLABS_API_KEY"];
        if (apiKey == null) {
            throw new errors.ElevenLabsError({
                message: "Please pass in your ElevenLabs API Key or export ELEVENLABS_API_KEY in your environment.",
            });
        }
        options.apiKey = apiKey;
        super(options);
    }
    /**
     * Generates audio for a voice.
     *
     * @deprecated Use `textToSpeech.convert` or `textToSpeech.convertAsStream` instead. Will be removed in a future major version.
     *
     * @example Generate the entire audio
     * import { play } from "elevenlabs";
     *
     * const audio = eleven.generate({
     *   voiceId: "Matilda" // defaults to Sarah
     * })
     * await play(audio);
     *
     * @example
     * import { stream } from "elevenlabs"
     *
     * const audioStream = eleven.generate({
     *   stream: true,
     *   voice: "Sarah"
     * })
     * await stream(audioStream);
     */
    generate(request_1) {
        return __awaiter(this, arguments, void 0, function* (request, requestOptions = {}) {
            var _a, _b;
            const voiceIdOrName = (_a = request.voice) !== null && _a !== void 0 ? _a : "Sarah";
            const voiceId = isVoiceId(voiceIdOrName)
                ? voiceIdOrName
                : (_b = (yield this.voices.getAll({
                    show_legacy: true,
                })).voices.filter((voice) => voice.name === voiceIdOrName)[0]) === null || _b === void 0 ? void 0 : _b.voice_id;
            if (voiceId == null) {
                throw new errors.ElevenLabsError({
                    message: `${voiceIdOrName} is not a valid voice name`,
                });
            }
            if (isGenerateAudioStream(request)) {
                return yield this.textToSpeech.convertAsStream(voiceId, request, requestOptions);
            }
            else {
                return yield this.textToSpeech.convert(voiceId, request, requestOptions);
            }
        });
    }
}
exports.ElevenLabsClient = ElevenLabsClient;
function isGenerateAudioStream(value) {
    return value.stream != null;
}
function isVoiceId(val) {
    return /^[a-zA-Z0-9]{20}$/.test(val);
}
