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
exports.AuditLogs = void 0;
const serializers_1 = require("./serializers");
class AuditLogs {
    constructor(workos) {
        this.workos = workos;
    }
    createEvent(organization, event, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.post('/audit_logs/events', {
                event: (0, serializers_1.serializeCreateAuditLogEventOptions)(event),
                organization_id: organization,
            }, options);
        });
    }
    createExport(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/audit_logs/exports', (0, serializers_1.serializeAuditLogExportOptions)(options));
            return (0, serializers_1.deserializeAuditLogExport)(data);
        });
    }
    getExport(auditLogExportId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/audit_logs/exports/${auditLogExportId}`);
            return (0, serializers_1.deserializeAuditLogExport)(data);
        });
    }
    createSchema(schema, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/audit_logs/actions/${schema.action}/schemas`, (0, serializers_1.serializeCreateAuditLogSchemaOptions)(schema), options);
            return (0, serializers_1.deserializeAuditLogSchema)(data);
        });
    }
}
exports.AuditLogs = AuditLogs;
