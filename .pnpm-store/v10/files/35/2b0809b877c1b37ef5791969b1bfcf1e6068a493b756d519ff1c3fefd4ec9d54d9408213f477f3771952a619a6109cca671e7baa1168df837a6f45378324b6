export var ERROR_CODES;
(function (ERROR_CODES) {
    ERROR_CODES["MISSING_DEFINITION"] = "ERR_REACTDOCGEN_MISSING_DEFINITION";
    ERROR_CODES["MULTIPLE_DEFINITIONS"] = "ERR_REACTDOCGEN_MULTIPLE_DEFINITIONS";
})(ERROR_CODES || (ERROR_CODES = {}));
const messages = new Map([
    [ERROR_CODES.MISSING_DEFINITION, 'No suitable component definition found.'],
    [
        ERROR_CODES.MULTIPLE_DEFINITIONS,
        'Multiple exported component definitions found.',
    ],
]);
export class ReactDocgenError extends Error {
    constructor(code) {
        super(messages.get(code));
        this.code = code;
    }
}
