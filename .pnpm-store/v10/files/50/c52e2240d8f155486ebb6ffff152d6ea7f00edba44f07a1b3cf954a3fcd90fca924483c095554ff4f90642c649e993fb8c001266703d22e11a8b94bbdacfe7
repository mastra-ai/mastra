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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jest_fetch_mock_1 = __importDefault(require("jest-fetch-mock"));
const workos_1 = require("../workos");
const test_utils_1 = require("../common/utils/test-utils");
const token_json_1 = __importDefault(require("./fixtures/token.json"));
const get_token_error_json_1 = __importDefault(require("./fixtures/get-token-error.json"));
describe('Widgets', () => {
    let workos;
    beforeAll(() => {
        workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
            apiHostname: 'api.workos.test',
            clientId: 'proj_123',
        });
    });
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('getToken', () => {
        it('sends a Get Token request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(token_json_1.default);
            const token = yield workos.widgets.getToken({
                organizationId: 'org_123',
                userId: 'user_123',
                scopes: ['widgets:users-table:manage'],
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/widgets/token');
            expect(token).toEqual('this.is.a.token');
        }));
        it('returns an error if the API returns an error', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(get_token_error_json_1.default, { status: 404 });
            yield expect(workos.widgets.getToken({
                organizationId: 'org_123',
                userId: 'user_123',
                scopes: ['widgets:users-table:manage'],
            })).rejects.toThrow("User not found 'user_123'");
        }));
    });
});
