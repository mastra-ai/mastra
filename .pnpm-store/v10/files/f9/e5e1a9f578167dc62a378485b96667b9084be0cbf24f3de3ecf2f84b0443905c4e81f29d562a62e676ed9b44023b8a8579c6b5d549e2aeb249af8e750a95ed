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
const crypto_1 = __importDefault(require("crypto"));
const workos_1 = require("../workos");
const webhook_json_1 = __importDefault(require("./fixtures/webhook.json"));
const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
const exceptions_1 = require("../common/exceptions");
describe('Webhooks', () => {
    let payload;
    let secret;
    let timestamp;
    let unhashedString;
    let signatureHash;
    let expectation;
    beforeEach(() => {
        payload = webhook_json_1.default;
        secret = 'secret';
        timestamp = Date.now() * 1000;
        unhashedString = `${timestamp}.${JSON.stringify(payload)}`;
        signatureHash = crypto_1.default
            .createHmac('sha256', secret)
            .update(unhashedString)
            .digest()
            .toString('hex');
        expectation = {
            id: 'directory_user_01FAEAJCR3ZBZ30D8BD1924TVG',
            state: 'active',
            emails: [
                {
                    type: 'work',
                    value: 'blair@foo-corp.com',
                    primary: true,
                },
            ],
            idpId: '00u1e8mutl6wlH3lL4x7',
            object: 'directory_user',
            username: 'blair@foo-corp.com',
            lastName: 'Lunchford',
            firstName: 'Blair',
            jobTitle: 'Software Engineer',
            directoryId: 'directory_01F9M7F68PZP8QXP8G7X5QRHS7',
            createdAt: '2021-06-25T19:07:33.155Z',
            updatedAt: '2021-06-25T19:07:33.155Z',
            rawAttributes: {
                name: {
                    givenName: 'Blair',
                    familyName: 'Lunchford',
                    middleName: 'Elizabeth',
                    honorificPrefix: 'Ms.',
                },
                title: 'Software Engineer',
                active: true,
                emails: [
                    {
                        type: 'work',
                        value: 'blair@foo-corp.com',
                        primary: true,
                    },
                ],
                groups: [],
                locale: 'en-US',
                schemas: [
                    'urn:ietf:params:scim:schemas:core:2.0:User',
                    'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
                ],
                userName: 'blair@foo-corp.com',
                addresses: [
                    {
                        region: 'CA',
                        primary: true,
                        locality: 'San Francisco',
                        postalCode: '94016',
                    },
                ],
                externalId: '00u1e8mutl6wlH3lL4x7',
                displayName: 'Blair Lunchford',
                'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
                    manager: {
                        value: '2',
                        displayName: 'Kate Chapman',
                    },
                    division: 'Engineering',
                    department: 'Customer Success',
                },
            },
        };
    });
    describe('constructEvent', () => {
        describe('with the correct payload, sig_header, and secret', () => {
            it('returns a webhook event', () => __awaiter(void 0, void 0, void 0, function* () {
                const sigHeader = `t=${timestamp}, v1=${signatureHash}`;
                const options = { payload, sigHeader, secret };
                const webhook = yield workos.webhooks.constructEvent(options);
                expect(webhook.data).toEqual(expectation);
                expect(webhook.event).toEqual('dsync.user.created');
                expect(webhook.id).toEqual('wh_123');
            }));
        });
        describe('with the correct payload, sig_header, secret, and tolerance', () => {
            it('returns a webhook event', () => __awaiter(void 0, void 0, void 0, function* () {
                const sigHeader = `t=${timestamp}, v1=${signatureHash}`;
                const options = { payload, sigHeader, secret, tolerance: 200 };
                const webhook = yield workos.webhooks.constructEvent(options);
                expect(webhook.data).toEqual(expectation);
                expect(webhook.event).toEqual('dsync.user.created');
                expect(webhook.id).toEqual('wh_123');
            }));
        });
        describe('with an empty header', () => {
            it('raises an error', () => __awaiter(void 0, void 0, void 0, function* () {
                const sigHeader = '';
                const options = { payload, sigHeader, secret };
                yield expect(workos.webhooks.constructEvent(options)).rejects.toThrowError(exceptions_1.SignatureVerificationException);
            }));
        });
        describe('with an empty signature hash', () => {
            it('raises an error', () => __awaiter(void 0, void 0, void 0, function* () {
                const sigHeader = `t=${timestamp}, v1=`;
                const options = { payload, sigHeader, secret };
                yield expect(workos.webhooks.constructEvent(options)).rejects.toThrowError(exceptions_1.SignatureVerificationException);
            }));
        });
        describe('with an incorrect signature hash', () => {
            it('raises an error', () => __awaiter(void 0, void 0, void 0, function* () {
                const sigHeader = `t=${timestamp}, v1=99999`;
                const options = { payload, sigHeader, secret };
                yield expect(workos.webhooks.constructEvent(options)).rejects.toThrowError(exceptions_1.SignatureVerificationException);
            }));
        });
        describe('with an incorrect payload', () => {
            it('raises an error', () => __awaiter(void 0, void 0, void 0, function* () {
                const sigHeader = `t=${timestamp}, v1=${signatureHash}`;
                payload = 'invalid';
                const options = { payload, sigHeader, secret };
                yield expect(workos.webhooks.constructEvent(options)).rejects.toThrowError(exceptions_1.SignatureVerificationException);
            }));
        });
        describe('with an incorrect webhook secret', () => {
            it('raises an error', () => __awaiter(void 0, void 0, void 0, function* () {
                const sigHeader = `t=${timestamp}, v1=${signatureHash}`;
                secret = 'invalid';
                const options = { payload, sigHeader, secret };
                yield expect(workos.webhooks.constructEvent(options)).rejects.toThrowError(exceptions_1.SignatureVerificationException);
            }));
        });
        describe('with a timestamp outside tolerance', () => {
            it('raises an error', () => __awaiter(void 0, void 0, void 0, function* () {
                const sigHeader = `t=9999, v1=${signatureHash}`;
                const options = { payload, sigHeader, secret };
                yield expect(workos.webhooks.constructEvent(options)).rejects.toThrowError(exceptions_1.SignatureVerificationException);
            }));
        });
    });
    describe('verifyHeader', () => {
        it('aliases to the signature provider', () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = jest.spyOn(
            // tslint:disable-next-line
            workos.webhooks['signatureProvider'], 'verifyHeader');
            yield workos.webhooks.verifyHeader({
                payload,
                sigHeader: `t=${timestamp}, v1=${signatureHash}`,
                secret,
            });
            expect(spy).toHaveBeenCalled();
        }));
    });
    describe('computeSignature', () => {
        it('aliases to the signature provider', () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = jest.spyOn(
            // tslint:disable-next-line
            workos.webhooks['signatureProvider'], 'computeSignature');
            yield workos.webhooks.computeSignature(timestamp, payload, secret);
            expect(spy).toHaveBeenCalled();
        }));
    });
    describe('getTimestampAndSignatureHash', () => {
        it('aliases to the signature provider', () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = jest.spyOn(
            // tslint:disable-next-line
            workos.webhooks['signatureProvider'], 'getTimestampAndSignatureHash');
            workos.webhooks.getTimestampAndSignatureHash(`t=${timestamp}, v1=${signatureHash}`);
            expect(spy).toHaveBeenCalled();
        }));
    });
});
