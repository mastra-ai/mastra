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
const test_utils_1 = require("../common/utils/test-utils");
const workos_1 = require("../workos");
const interfaces_1 = require("../sso/interfaces");
describe('Event', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
    const event = {
        id: 'event_01234ABCD',
        createdAt: '2020-05-06 04:21:48.649164',
        event: 'connection.activated',
        data: {
            object: 'connection',
            id: 'conn_01234ABCD',
            organizationId: 'org_1234',
            name: 'Connection',
            type: interfaces_1.ConnectionType.OktaSAML,
            connectionType: interfaces_1.ConnectionType.OktaSAML,
            state: 'active',
            domains: [],
            createdAt: '2020-05-06 04:21:48.649164',
            updatedAt: '2020-05-06 04:21:48.649164',
        },
    };
    const eventResponse = {
        id: 'event_01234ABCD',
        created_at: '2020-05-06 04:21:48.649164',
        event: 'connection.activated',
        data: {
            object: 'connection',
            id: 'conn_01234ABCD',
            organization_id: 'org_1234',
            name: 'Connection',
            connection_type: interfaces_1.ConnectionType.OktaSAML,
            state: 'active',
            domains: [],
            created_at: '2020-05-06 04:21:48.649164',
            updated_at: '2020-05-06 04:21:48.649164',
        },
    };
    describe('listEvents', () => {
        const eventsListResponse = {
            object: 'list',
            data: [eventResponse],
            list_metadata: {},
        };
        describe('with options', () => {
            it('requests Events with query parameters', () => __awaiter(void 0, void 0, void 0, function* () {
                const eventsResponse = {
                    object: 'list',
                    data: [eventResponse],
                    list_metadata: {},
                };
                (0, test_utils_1.fetchOnce)(eventsResponse);
                const list = yield workos.events.listEvents({
                    events: ['connection.activated'],
                    rangeStart: '2020-05-04',
                    rangeEnd: '2020-05-07',
                });
                expect((0, test_utils_1.fetchSearchParams)()).toMatchObject({
                    events: 'connection.activated',
                    range_start: '2020-05-04',
                    range_end: '2020-05-07',
                });
                expect(list).toEqual({
                    object: 'list',
                    data: [event],
                    listMetadata: {},
                });
            }));
        });
        it(`requests Events with a valid event name`, () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(eventsListResponse);
            const list = yield workos.events.listEvents({
                events: ['connection.activated'],
            });
            expect(list).toEqual({
                object: 'list',
                data: [event],
                listMetadata: {},
            });
        }));
        it(`requests Events with a valid organization id`, () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(eventsListResponse);
            const list = yield workos.events.listEvents({
                events: ['connection.activated'],
                organizationId: 'org_1234',
            });
            expect(list).toEqual({
                object: 'list',
                data: [event],
                listMetadata: {},
            });
        }));
        describe('directory user updated events', () => {
            describe('with a role', () => {
                const directoryUserUpdated = {
                    id: 'event_01234ABCD',
                    createdAt: '2020-05-06 04:21:48.649164',
                    event: 'dsync.user.updated',
                    data: {
                        object: 'directory_user',
                        id: 'directory_user_456',
                        customAttributes: {
                            custom: true,
                        },
                        directoryId: 'dir_123',
                        organizationId: 'org_123',
                        email: 'jonsnow@workos.com',
                        emails: [
                            {
                                primary: true,
                                type: 'type',
                                value: 'jonsnow@workos.com',
                            },
                        ],
                        firstName: 'Jon',
                        idpId: 'idp_foo',
                        lastName: 'Snow',
                        jobTitle: 'Knight of the Watch',
                        rawAttributes: {},
                        state: 'active',
                        username: 'jonsnow',
                        role: { slug: 'super_admin' },
                        previousAttributes: {
                            role: { slug: 'member' },
                        },
                        createdAt: '2021-10-27 15:21:50.640959',
                        updatedAt: '2021-12-13 12:15:45.531847',
                    },
                };
                const directoryUserUpdatedResponse = {
                    id: 'event_01234ABCD',
                    created_at: '2020-05-06 04:21:48.649164',
                    event: 'dsync.user.updated',
                    data: {
                        object: 'directory_user',
                        id: 'directory_user_456',
                        custom_attributes: {
                            custom: true,
                        },
                        directory_id: 'dir_123',
                        organization_id: 'org_123',
                        email: 'jonsnow@workos.com',
                        emails: [
                            {
                                primary: true,
                                type: 'type',
                                value: 'jonsnow@workos.com',
                            },
                        ],
                        first_name: 'Jon',
                        idp_id: 'idp_foo',
                        last_name: 'Snow',
                        job_title: 'Knight of the Watch',
                        raw_attributes: {},
                        state: 'active',
                        username: 'jonsnow',
                        role: { slug: 'super_admin' },
                        previous_attributes: {
                            role: { slug: 'member' },
                        },
                        created_at: '2021-10-27 15:21:50.640959',
                        updated_at: '2021-12-13 12:15:45.531847',
                    },
                };
                const directoryUserEventsListResponse = {
                    object: 'list',
                    data: [directoryUserUpdatedResponse],
                    list_metadata: {},
                };
                it(`returns the role`, () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)(directoryUserEventsListResponse);
                    const list = yield workos.events.listEvents({
                        events: ['dsync.user.updated'],
                    });
                    expect(list).toEqual({
                        object: 'list',
                        data: [directoryUserUpdated],
                        listMetadata: {},
                    });
                }));
            });
        });
    });
});
