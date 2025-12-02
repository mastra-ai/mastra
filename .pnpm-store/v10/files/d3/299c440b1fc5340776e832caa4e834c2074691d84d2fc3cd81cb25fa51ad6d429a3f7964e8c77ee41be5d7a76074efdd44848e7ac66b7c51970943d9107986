"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_serializer_1 = require("./user.serializer");
const user_json_1 = __importDefault(require("../fixtures/user.json"));
describe('deserializeUser', () => {
    it('includes metadata if present', () => {
        const metadata = { key: 'value' };
        expect((0, user_serializer_1.deserializeUser)(Object.assign(Object.assign({}, user_json_1.default), { object: 'user', metadata }))).toMatchObject({
            metadata,
        });
    });
    it('coerces missing metadata to empty object', () => {
        const { metadata } = user_json_1.default, userResponseWithoutMetadata = __rest(user_json_1.default, ["metadata"]);
        expect((0, user_serializer_1.deserializeUser)(Object.assign(Object.assign({}, userResponseWithoutMetadata), { object: 'user' }))).toMatchObject({
            metadata: {},
        });
    });
});
