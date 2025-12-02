/**
 * Represents a keyword recognition model for recognizing when
 * the user says a keyword to initiate further speech recognition.
 * @class KeywordRecognitionModel
 */
export declare class KeywordRecognitionModel {
    private privDisposed;
    /**
     * Create and initializes a new instance.
     * @constructor
     */
    private constructor();
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
    static fromFile(fileName: string): KeywordRecognitionModel;
    /**
     * Creates a keyword recognition model using the specified filename.
     * @member KeywordRecognitionModel.fromStream
     * @function
     * @public
     * @param {string} file - A File that represents file for the keyword recognition model.
     * Note, the file can point to a zip file in which case the model will be extracted from the zip.
     * @returns {KeywordRecognitionModel} The keyword recognition model being created.
     */
    static fromStream(file: File): KeywordRecognitionModel;
    /**
     * Dispose of associated resources.
     * @member KeywordRecognitionModel.prototype.close
     * @function
     * @public
     */
    close(): void;
}
