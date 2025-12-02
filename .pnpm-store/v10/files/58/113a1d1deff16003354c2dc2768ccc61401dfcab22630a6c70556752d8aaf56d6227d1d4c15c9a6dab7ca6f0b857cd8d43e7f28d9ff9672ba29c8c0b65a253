"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnprocessableEntityException = void 0;
const pluralize_1 = __importDefault(require("pluralize"));
class UnprocessableEntityException extends Error {
    constructor({ code, errors, message, requestID, }) {
        super();
        this.status = 422;
        this.name = 'UnprocessableEntityException';
        this.message = 'Unprocessable entity';
        this.requestID = requestID;
        if (message) {
            this.message = message;
        }
        if (code) {
            this.code = code;
        }
        if (errors) {
            const requirement = (0, pluralize_1.default)('requirement', errors.length);
            this.message = `The following ${requirement} must be met:\n`;
            for (const { code } of errors) {
                this.message = this.message.concat(`\t${code}\n`);
            }
        }
    }
}
exports.UnprocessableEntityException = UnprocessableEntityException;
