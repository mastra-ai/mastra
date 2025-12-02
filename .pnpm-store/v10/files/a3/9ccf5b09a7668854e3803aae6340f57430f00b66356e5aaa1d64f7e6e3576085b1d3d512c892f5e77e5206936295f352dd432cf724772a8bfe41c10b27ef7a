"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogLevelFromEnv = exports.getResourceDetectorsFromEnv = exports.getNodeAutoInstrumentations = void 0;
const api_1 = require("@opentelemetry/api");
const instrumentation_amqplib_1 = require("@opentelemetry/instrumentation-amqplib");
const instrumentation_aws_lambda_1 = require("@opentelemetry/instrumentation-aws-lambda");
const instrumentation_aws_sdk_1 = require("@opentelemetry/instrumentation-aws-sdk");
const instrumentation_bunyan_1 = require("@opentelemetry/instrumentation-bunyan");
const instrumentation_cassandra_driver_1 = require("@opentelemetry/instrumentation-cassandra-driver");
const instrumentation_connect_1 = require("@opentelemetry/instrumentation-connect");
const instrumentation_cucumber_1 = require("@opentelemetry/instrumentation-cucumber");
const instrumentation_dataloader_1 = require("@opentelemetry/instrumentation-dataloader");
const instrumentation_dns_1 = require("@opentelemetry/instrumentation-dns");
const instrumentation_express_1 = require("@opentelemetry/instrumentation-express");
const instrumentation_fastify_1 = require("@opentelemetry/instrumentation-fastify");
const instrumentation_fs_1 = require("@opentelemetry/instrumentation-fs");
const instrumentation_generic_pool_1 = require("@opentelemetry/instrumentation-generic-pool");
const instrumentation_graphql_1 = require("@opentelemetry/instrumentation-graphql");
const instrumentation_grpc_1 = require("@opentelemetry/instrumentation-grpc");
const instrumentation_hapi_1 = require("@opentelemetry/instrumentation-hapi");
const instrumentation_http_1 = require("@opentelemetry/instrumentation-http");
const instrumentation_ioredis_1 = require("@opentelemetry/instrumentation-ioredis");
const instrumentation_kafkajs_1 = require("@opentelemetry/instrumentation-kafkajs");
const instrumentation_knex_1 = require("@opentelemetry/instrumentation-knex");
const instrumentation_koa_1 = require("@opentelemetry/instrumentation-koa");
const instrumentation_lru_memoizer_1 = require("@opentelemetry/instrumentation-lru-memoizer");
const instrumentation_memcached_1 = require("@opentelemetry/instrumentation-memcached");
const instrumentation_mongodb_1 = require("@opentelemetry/instrumentation-mongodb");
const instrumentation_mongoose_1 = require("@opentelemetry/instrumentation-mongoose");
const instrumentation_mysql2_1 = require("@opentelemetry/instrumentation-mysql2");
const instrumentation_mysql_1 = require("@opentelemetry/instrumentation-mysql");
const instrumentation_nestjs_core_1 = require("@opentelemetry/instrumentation-nestjs-core");
const instrumentation_net_1 = require("@opentelemetry/instrumentation-net");
const instrumentation_pg_1 = require("@opentelemetry/instrumentation-pg");
const instrumentation_pino_1 = require("@opentelemetry/instrumentation-pino");
const instrumentation_redis_1 = require("@opentelemetry/instrumentation-redis");
const instrumentation_redis_4_1 = require("@opentelemetry/instrumentation-redis-4");
const instrumentation_restify_1 = require("@opentelemetry/instrumentation-restify");
const instrumentation_router_1 = require("@opentelemetry/instrumentation-router");
const instrumentation_socket_io_1 = require("@opentelemetry/instrumentation-socket.io");
const instrumentation_tedious_1 = require("@opentelemetry/instrumentation-tedious");
const instrumentation_undici_1 = require("@opentelemetry/instrumentation-undici");
const instrumentation_winston_1 = require("@opentelemetry/instrumentation-winston");
const resource_detector_alibaba_cloud_1 = require("@opentelemetry/resource-detector-alibaba-cloud");
const resource_detector_aws_1 = require("@opentelemetry/resource-detector-aws");
const resource_detector_container_1 = require("@opentelemetry/resource-detector-container");
const resource_detector_gcp_1 = require("@opentelemetry/resource-detector-gcp");
const resources_1 = require("@opentelemetry/resources");
const resource_detector_azure_1 = require("@opentelemetry/resource-detector-azure");
const RESOURCE_DETECTOR_CONTAINER = 'container';
const RESOURCE_DETECTOR_ENVIRONMENT = 'env';
const RESOURCE_DETECTOR_HOST = 'host';
const RESOURCE_DETECTOR_OS = 'os';
const RESOURCE_DETECTOR_SERVICE_INSTANCE_ID = 'serviceinstance';
const RESOURCE_DETECTOR_PROCESS = 'process';
const RESOURCE_DETECTOR_ALIBABA = 'alibaba';
const RESOURCE_DETECTOR_AWS = 'aws';
const RESOURCE_DETECTOR_AZURE = 'azure';
const RESOURCE_DETECTOR_GCP = 'gcp';
const InstrumentationMap = {
    '@opentelemetry/instrumentation-amqplib': instrumentation_amqplib_1.AmqplibInstrumentation,
    '@opentelemetry/instrumentation-aws-lambda': instrumentation_aws_lambda_1.AwsLambdaInstrumentation,
    '@opentelemetry/instrumentation-aws-sdk': instrumentation_aws_sdk_1.AwsInstrumentation,
    '@opentelemetry/instrumentation-bunyan': instrumentation_bunyan_1.BunyanInstrumentation,
    '@opentelemetry/instrumentation-cassandra-driver': instrumentation_cassandra_driver_1.CassandraDriverInstrumentation,
    '@opentelemetry/instrumentation-connect': instrumentation_connect_1.ConnectInstrumentation,
    '@opentelemetry/instrumentation-cucumber': instrumentation_cucumber_1.CucumberInstrumentation,
    '@opentelemetry/instrumentation-dataloader': instrumentation_dataloader_1.DataloaderInstrumentation,
    '@opentelemetry/instrumentation-dns': instrumentation_dns_1.DnsInstrumentation,
    '@opentelemetry/instrumentation-express': instrumentation_express_1.ExpressInstrumentation,
    '@opentelemetry/instrumentation-fastify': instrumentation_fastify_1.FastifyInstrumentation,
    '@opentelemetry/instrumentation-fs': instrumentation_fs_1.FsInstrumentation,
    '@opentelemetry/instrumentation-generic-pool': instrumentation_generic_pool_1.GenericPoolInstrumentation,
    '@opentelemetry/instrumentation-graphql': instrumentation_graphql_1.GraphQLInstrumentation,
    '@opentelemetry/instrumentation-grpc': instrumentation_grpc_1.GrpcInstrumentation,
    '@opentelemetry/instrumentation-hapi': instrumentation_hapi_1.HapiInstrumentation,
    '@opentelemetry/instrumentation-http': instrumentation_http_1.HttpInstrumentation,
    '@opentelemetry/instrumentation-ioredis': instrumentation_ioredis_1.IORedisInstrumentation,
    '@opentelemetry/instrumentation-kafkajs': instrumentation_kafkajs_1.KafkaJsInstrumentation,
    '@opentelemetry/instrumentation-knex': instrumentation_knex_1.KnexInstrumentation,
    '@opentelemetry/instrumentation-koa': instrumentation_koa_1.KoaInstrumentation,
    '@opentelemetry/instrumentation-lru-memoizer': instrumentation_lru_memoizer_1.LruMemoizerInstrumentation,
    '@opentelemetry/instrumentation-memcached': instrumentation_memcached_1.MemcachedInstrumentation,
    '@opentelemetry/instrumentation-mongodb': instrumentation_mongodb_1.MongoDBInstrumentation,
    '@opentelemetry/instrumentation-mongoose': instrumentation_mongoose_1.MongooseInstrumentation,
    '@opentelemetry/instrumentation-mysql2': instrumentation_mysql2_1.MySQL2Instrumentation,
    '@opentelemetry/instrumentation-mysql': instrumentation_mysql_1.MySQLInstrumentation,
    '@opentelemetry/instrumentation-nestjs-core': instrumentation_nestjs_core_1.NestInstrumentation,
    '@opentelemetry/instrumentation-net': instrumentation_net_1.NetInstrumentation,
    '@opentelemetry/instrumentation-pg': instrumentation_pg_1.PgInstrumentation,
    '@opentelemetry/instrumentation-pino': instrumentation_pino_1.PinoInstrumentation,
    '@opentelemetry/instrumentation-redis': instrumentation_redis_1.RedisInstrumentation,
    '@opentelemetry/instrumentation-redis-4': instrumentation_redis_4_1.RedisInstrumentation,
    '@opentelemetry/instrumentation-restify': instrumentation_restify_1.RestifyInstrumentation,
    '@opentelemetry/instrumentation-router': instrumentation_router_1.RouterInstrumentation,
    '@opentelemetry/instrumentation-socket.io': instrumentation_socket_io_1.SocketIoInstrumentation,
    '@opentelemetry/instrumentation-tedious': instrumentation_tedious_1.TediousInstrumentation,
    '@opentelemetry/instrumentation-undici': instrumentation_undici_1.UndiciInstrumentation,
    '@opentelemetry/instrumentation-winston': instrumentation_winston_1.WinstonInstrumentation,
};
// The support string -> DiagLogLevel mappings
const logLevelMap = {
    ALL: api_1.DiagLogLevel.ALL,
    VERBOSE: api_1.DiagLogLevel.VERBOSE,
    DEBUG: api_1.DiagLogLevel.DEBUG,
    INFO: api_1.DiagLogLevel.INFO,
    WARN: api_1.DiagLogLevel.WARN,
    ERROR: api_1.DiagLogLevel.ERROR,
    NONE: api_1.DiagLogLevel.NONE,
};
const defaultExcludedInstrumentations = [
    '@opentelemetry/instrumentation-fs',
    '@opentelemetry/instrumentation-fastify',
];
function getNodeAutoInstrumentations(inputConfigs = {}) {
    var _a;
    checkManuallyProvidedInstrumentationNames(Object.keys(inputConfigs));
    const enabledInstrumentationsFromEnv = getEnabledInstrumentationsFromEnv();
    const disabledInstrumentationsFromEnv = getDisabledInstrumentationsFromEnv();
    const instrumentations = [];
    for (const name of Object.keys(InstrumentationMap)) {
        const Instance = InstrumentationMap[name];
        // Defaults are defined by the instrumentation itself
        const userConfig = (_a = inputConfigs[name]) !== null && _a !== void 0 ? _a : {};
        if (userConfig.enabled === false ||
            !enabledInstrumentationsFromEnv.includes(name) ||
            disabledInstrumentationsFromEnv.includes(name)) {
            api_1.diag.debug(`Disabling instrumentation for ${name}`);
            continue;
        }
        try {
            api_1.diag.debug(`Loading instrumentation for ${name}`);
            instrumentations.push(new Instance(userConfig));
        }
        catch (e) {
            api_1.diag.error(e);
        }
    }
    return instrumentations;
}
exports.getNodeAutoInstrumentations = getNodeAutoInstrumentations;
function checkManuallyProvidedInstrumentationNames(manuallyProvidedInstrumentationNames) {
    for (const name of manuallyProvidedInstrumentationNames) {
        if (!Object.prototype.hasOwnProperty.call(InstrumentationMap, name)) {
            api_1.diag.error(`Provided instrumentation name "${name}" not found`);
        }
    }
}
function getInstrumentationsFromEnv(envVar) {
    const envVarValue = process.env[envVar];
    if (envVarValue == null) {
        return [];
    }
    const instrumentationsFromEnv = envVarValue === null || envVarValue === void 0 ? void 0 : envVarValue.split(',').map(instrumentationPkgSuffix => `@opentelemetry/instrumentation-${instrumentationPkgSuffix.trim()}`);
    checkManuallyProvidedInstrumentationNames(instrumentationsFromEnv);
    return instrumentationsFromEnv;
}
/**
 * Returns the list of instrumentations that are enabled based on the environment variable.
 * If the environment variable is unset, returns all instrumentation that are enabled by default.
 */
function getEnabledInstrumentationsFromEnv() {
    if (!process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS) {
        // all keys in the InstrumentationMap except for everything that is not enabled by default.
        return Object.keys(InstrumentationMap).filter(key => !defaultExcludedInstrumentations.includes(key));
    }
    const instrumentationsFromEnv = getInstrumentationsFromEnv('OTEL_NODE_ENABLED_INSTRUMENTATIONS');
    return instrumentationsFromEnv;
}
/**
 * Returns the list of instrumentations that are disabled based on the environment variable.
 */
function getDisabledInstrumentationsFromEnv() {
    if (!process.env.OTEL_NODE_DISABLED_INSTRUMENTATIONS) {
        return [];
    }
    const instrumentationsFromEnv = getInstrumentationsFromEnv('OTEL_NODE_DISABLED_INSTRUMENTATIONS');
    return instrumentationsFromEnv;
}
function getResourceDetectorsFromEnv() {
    var _a, _b;
    const resourceDetectors = new Map([
        [RESOURCE_DETECTOR_CONTAINER, resource_detector_container_1.containerDetector],
        [RESOURCE_DETECTOR_ENVIRONMENT, resources_1.envDetectorSync],
        [RESOURCE_DETECTOR_HOST, resources_1.hostDetectorSync],
        [RESOURCE_DETECTOR_OS, resources_1.osDetectorSync],
        [RESOURCE_DETECTOR_SERVICE_INSTANCE_ID, resources_1.serviceInstanceIdDetectorSync],
        [RESOURCE_DETECTOR_PROCESS, resources_1.processDetectorSync],
        [RESOURCE_DETECTOR_ALIBABA, resource_detector_alibaba_cloud_1.alibabaCloudEcsDetector],
        [RESOURCE_DETECTOR_GCP, resource_detector_gcp_1.gcpDetector],
        [
            RESOURCE_DETECTOR_AWS,
            [
                resource_detector_aws_1.awsEc2Detector,
                resource_detector_aws_1.awsEcsDetector,
                resource_detector_aws_1.awsEksDetector,
                resource_detector_aws_1.awsBeanstalkDetector,
                resource_detector_aws_1.awsLambdaDetector,
            ],
        ],
        [
            RESOURCE_DETECTOR_AZURE,
            [resource_detector_azure_1.azureAppServiceDetector, resource_detector_azure_1.azureFunctionsDetector, resource_detector_azure_1.azureVmDetector],
        ],
    ]);
    const resourceDetectorsFromEnv = (_b = (_a = process.env.OTEL_NODE_RESOURCE_DETECTORS) === null || _a === void 0 ? void 0 : _a.split(',')) !== null && _b !== void 0 ? _b : ['all'];
    if (resourceDetectorsFromEnv.includes('all')) {
        return [...resourceDetectors.values()].flat();
    }
    if (resourceDetectorsFromEnv.includes('none')) {
        return [];
    }
    return resourceDetectorsFromEnv.flatMap(detector => {
        const resourceDetector = resourceDetectors.get(detector);
        if (!resourceDetector) {
            api_1.diag.error(`Invalid resource detector "${detector}" specified in the environment variable OTEL_NODE_RESOURCE_DETECTORS`);
        }
        return resourceDetector || [];
    });
}
exports.getResourceDetectorsFromEnv = getResourceDetectorsFromEnv;
function getLogLevelFromEnv() {
    var _a, _b;
    const rawLogLevel = process.env.OTEL_LOG_LEVEL;
    // NOTE: as per specification we should actually only register if something is set, but our previous implementation
    // always registered a logger, even when nothing was set. Falling back to 'INFO' here to keep the same behavior as
    // with previous implementations.
    // Also: no point in warning - no logger is registered yet
    return ((_b = logLevelMap[(_a = rawLogLevel === null || rawLogLevel === void 0 ? void 0 : rawLogLevel.trim().toUpperCase()) !== null && _a !== void 0 ? _a : 'INFO']) !== null && _b !== void 0 ? _b : api_1.DiagLogLevel.INFO);
}
exports.getLogLevelFromEnv = getLogLevelFromEnv;
//# sourceMappingURL=utils.js.map