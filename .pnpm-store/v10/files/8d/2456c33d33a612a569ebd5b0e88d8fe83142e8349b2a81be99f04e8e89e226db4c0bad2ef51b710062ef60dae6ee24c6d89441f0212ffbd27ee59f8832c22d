"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesExtensions = void 0;
const sqs_1 = require("./sqs");
const dynamodb_1 = require("./dynamodb");
const sns_1 = require("./sns");
const lambda_1 = require("./lambda");
const s3_1 = require("./s3");
const kinesis_1 = require("./kinesis");
class ServicesExtensions {
    constructor() {
        this.services = new Map();
        this.services.set('SQS', new sqs_1.SqsServiceExtension());
        this.services.set('SNS', new sns_1.SnsServiceExtension());
        this.services.set('DynamoDB', new dynamodb_1.DynamodbServiceExtension());
        this.services.set('Lambda', new lambda_1.LambdaServiceExtension());
        this.services.set('S3', new s3_1.S3ServiceExtension());
        this.services.set('Kinesis', new kinesis_1.KinesisServiceExtension());
    }
    requestPreSpanHook(request, config, diag) {
        const serviceExtension = this.services.get(request.serviceName);
        if (!serviceExtension)
            return {
                isIncoming: false,
            };
        return serviceExtension.requestPreSpanHook(request, config, diag);
    }
    requestPostSpanHook(request) {
        const serviceExtension = this.services.get(request.serviceName);
        if (!(serviceExtension === null || serviceExtension === void 0 ? void 0 : serviceExtension.requestPostSpanHook))
            return;
        return serviceExtension.requestPostSpanHook(request);
    }
    responseHook(response, span, tracer, config) {
        var _a;
        const serviceExtension = this.services.get(response.request.serviceName);
        (_a = serviceExtension === null || serviceExtension === void 0 ? void 0 : serviceExtension.responseHook) === null || _a === void 0 ? void 0 : _a.call(serviceExtension, response, span, tracer, config);
    }
}
exports.ServicesExtensions = ServicesExtensions;
//# sourceMappingURL=ServicesExtensions.js.map