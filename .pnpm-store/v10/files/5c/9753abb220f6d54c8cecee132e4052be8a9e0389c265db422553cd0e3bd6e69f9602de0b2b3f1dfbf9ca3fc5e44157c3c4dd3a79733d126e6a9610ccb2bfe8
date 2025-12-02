"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioFileWriter = void 0;
const fs = __importStar(require("fs"));
const Contracts_js_1 = require("../Contracts.js");
class AudioFileWriter {
    constructor(filename) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(fs.openSync, "\nFile System access not available, please use Push or PullAudioOutputStream");
        this.privFd = fs.openSync(filename, "w");
    }
    set format(format) {
        Contracts_js_1.Contracts.throwIfNotUndefined(this.privAudioFormat, "format is already set");
        this.privAudioFormat = format;
        let headerOffset = 0;
        if (this.privAudioFormat.hasHeader) {
            headerOffset = this.privAudioFormat.header.byteLength;
        }
        if (this.privFd !== undefined) {
            this.privWriteStream = fs.createWriteStream("", { fd: this.privFd, start: headerOffset, autoClose: false });
        }
    }
    write(buffer) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privAudioFormat, "must set format before writing.");
        if (this.privWriteStream !== undefined) {
            this.privWriteStream.write(new Uint8Array(buffer.slice(0)));
        }
    }
    close() {
        if (this.privFd !== undefined) {
            this.privWriteStream.on("finish", () => {
                if (this.privAudioFormat.hasHeader) {
                    this.privAudioFormat.updateHeader(this.privWriteStream.bytesWritten);
                    fs.writeSync(this.privFd, new Int8Array(this.privAudioFormat.header), 0, this.privAudioFormat.header.byteLength, 0);
                }
                fs.closeSync(this.privFd);
                this.privFd = undefined;
            });
            this.privWriteStream.end();
        }
    }
    id() {
        return this.privId;
    }
}
exports.AudioFileWriter = AudioFileWriter;

//# sourceMappingURL=AudioFileWriter.js.map
