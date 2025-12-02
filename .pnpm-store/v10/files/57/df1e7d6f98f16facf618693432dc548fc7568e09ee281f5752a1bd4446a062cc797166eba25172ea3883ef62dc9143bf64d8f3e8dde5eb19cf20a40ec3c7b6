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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectorySync = void 0;
const pagination_1 = require("../common/utils/pagination");
const serializers_1 = require("./serializers");
const fetch_and_deserialize_1 = require("../common/utils/fetch-and-deserialize");
class DirectorySync {
    constructor(workos) {
        this.workos = workos;
    }
    listDirectories(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/directories', serializers_1.deserializeDirectory, options ? (0, serializers_1.serializeListDirectoriesOptions)(options) : undefined), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/directories', serializers_1.deserializeDirectory, params), options ? (0, serializers_1.serializeListDirectoriesOptions)(options) : undefined);
        });
    }
    getDirectory(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/directories/${id}`);
            return (0, serializers_1.deserializeDirectory)(data);
        });
    }
    deleteDirectory(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.delete(`/directories/${id}`);
        });
    }
    listGroups(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/directory_groups', serializers_1.deserializeDirectoryGroup, options), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/directory_groups', serializers_1.deserializeDirectoryGroup, params), options);
        });
    }
    listUsers(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/directory_users', serializers_1.deserializeDirectoryUserWithGroups, options), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/directory_users', serializers_1.deserializeDirectoryUserWithGroups, params), options);
        });
    }
    getUser(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/directory_users/${user}`);
            return (0, serializers_1.deserializeDirectoryUserWithGroups)(data);
        });
    }
    getGroup(group) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/directory_groups/${group}`);
            return (0, serializers_1.deserializeDirectoryGroup)(data);
        });
    }
}
exports.DirectorySync = DirectorySync;
