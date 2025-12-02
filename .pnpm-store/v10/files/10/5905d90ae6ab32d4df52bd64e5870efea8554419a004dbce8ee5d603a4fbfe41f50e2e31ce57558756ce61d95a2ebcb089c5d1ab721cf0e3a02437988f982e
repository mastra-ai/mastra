"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordRecognitionModel = void 0;
const Contracts_js_1 = require("./Contracts.js");
/**
 * Represents a keyword recognition model for recognizing when
 * the user says a keyword to initiate further speech recognition.
 * @class KeywordRecognitionModel
 */
class KeywordRecognitionModel {
    /**
     * Create and initializes a new instance.
     * @constructor
     */
    constructor() {
        this.privDisposed = false;
        return;
    }
    /**
     * Creates a keyword recognition model using the specified filename.
     * @member KeywordRecognitionModel.fromFile
     * @function
     * @public
     * @param {string} fileName - A string that represents file name for the keyword recognition model.
     * Note, the file can point to a zip file in which case the model
     * will be extracted from the zip.
     * @returns {KeywordRecognitionModel} The keyword recognition model being created.
     */
    static fromFile(fileName) {
        Contracts_js_1.Contracts.throwIfFileDoesNotExist(fileName, "fileName");
        throw new Error("Not yet implemented.");
    }
    /**
     * Creates a keyword recognition model using the specified filename.
     * @member KeywordRecognitionModel.fromStream
     * @function
     * @public
     * @param {string} file - A File that represents file for the keyword recognition model.
     * Note, the file can point to a zip file in which case the model will be extracted from the zip.
     * @returns {KeywordRecognitionModel} The keyword recognition model being created.
     */
    static fromStream(file) {
        Contracts_js_1.Contracts.throwIfNull(file, "file");
        throw new Error("Not yet implemented.");
    }
    /**
     * Dispose of associated resources.
     * @member KeywordRecognitionModel.prototype.close
     * @function
     * @public
     */
    close() {
        if (this.privDisposed) {
            return;
        }
        this.privDisposed = true;
    }
}
exports.KeywordRecognitionModel = KeywordRecognitionModel;

//# sourceMappingURL=KeywordRecognitionModel.js.map
