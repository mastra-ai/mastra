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
exports.CLOUD_PROVIDER_VALUE_AWS = exports.CLOUD_PLATFORM_VALUE_AWS_LAMBDA = exports.CLOUD_PLATFORM_VALUE_AWS_ELASTIC_BEANSTALK = exports.CLOUD_PLATFORM_VALUE_AWS_EKS = exports.CLOUD_PLATFORM_VALUE_AWS_ECS = exports.CLOUD_PLATFORM_VALUE_AWS_EC2 = exports.ATTR_SERVICE_NAMESPACE = exports.ATTR_SERVICE_INSTANCE_ID = exports.ATTR_K8S_CLUSTER_NAME = exports.ATTR_HOST_TYPE = exports.ATTR_HOST_NAME = exports.ATTR_HOST_ID = exports.ATTR_FAAS_VERSION = exports.ATTR_FAAS_MAX_MEMORY = exports.ATTR_FAAS_INSTANCE = exports.ATTR_FAAS_NAME = exports.ATTR_CONTAINER_NAME = exports.ATTR_CONTAINER_ID = exports.ATTR_CLOUD_RESOURCE_ID = exports.ATTR_CLOUD_REGION = exports.ATTR_CLOUD_PROVIDER = exports.ATTR_CLOUD_PLATFORM = exports.ATTR_CLOUD_AVAILABILITY_ZONE = exports.ATTR_CLOUD_ACCOUNT_ID = exports.ATTR_AWS_LOG_STREAM_NAMES = exports.ATTR_AWS_LOG_STREAM_ARNS = exports.ATTR_AWS_LOG_GROUP_NAMES = exports.ATTR_AWS_LOG_GROUP_ARNS = exports.ATTR_AWS_ECS_TASK_REVISION = exports.ATTR_AWS_ECS_TASK_FAMILY = exports.ATTR_AWS_ECS_TASK_ARN = exports.ATTR_AWS_ECS_LAUNCHTYPE = exports.ATTR_AWS_ECS_CONTAINER_ARN = exports.ATTR_AWS_ECS_CLUSTER_ARN = void 0;
/*
 * This file contains a copy of unstable semantic convention definitions
 * used by this package.
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/main/semantic-conventions#unstable-semconv
 */
/**
 * The ARN of an [ECS cluster](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/clusters.html).
 *
 * @example arn:aws:ecs:us-west-2:123456789123:cluster/my-cluster
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_ECS_CLUSTER_ARN = 'aws.ecs.cluster.arn';
/**
 * The Amazon Resource Name (ARN) of an [ECS container instance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ECS_instances.html).
 *
 * @example arn:aws:ecs:us-west-1:123456789123:container/32624152-9086-4f0e-acae-1a75b14fe4d9
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_ECS_CONTAINER_ARN = 'aws.ecs.container.arn';
/**
 * The [launch type](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/launch_types.html) for an ECS task.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_ECS_LAUNCHTYPE = 'aws.ecs.launchtype';
/**
 * The ARN of a running [ECS task](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-account-settings.html#ecs-resource-ids).
 *
 * @example arn:aws:ecs:us-west-1:123456789123:task/10838bed-421f-43ef-870a-f43feacbbb5b
 * @example arn:aws:ecs:us-west-1:123456789123:task/my-cluster/task-id/23ebb8ac-c18f-46c6-8bbe-d55d0e37cfbd
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_ECS_TASK_ARN = 'aws.ecs.task.arn';
/**
 * The family name of the [ECS task definition](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html) used to create the ECS task.
 *
 * @example opentelemetry-family
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_ECS_TASK_FAMILY = 'aws.ecs.task.family';
/**
 * The revision for the task definition used to create the ECS task.
 *
 * @example 8
 * @example 26
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_ECS_TASK_REVISION = 'aws.ecs.task.revision';
/**
 * The Amazon Resource Name(s) (ARN) of the AWS log group(s).
 *
 * @example ["arn:aws:logs:us-west-1:123456789012:log-group:/aws/my/group:*"]
 *
 * @note See the [log group ARN format documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/iam-access-control-overview-cwl.html#CWL_ARN_Format).
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_LOG_GROUP_ARNS = 'aws.log.group.arns';
/**
 * The name(s) of the AWS log group(s) an application is writing to.
 *
 * @example ["/aws/lambda/my-function", "opentelemetry-service"]
 *
 * @note Multiple log groups must be supported for cases like multi-container applications, where a single application has sidecar containers, and each write to their own log group.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_LOG_GROUP_NAMES = 'aws.log.group.names';
/**
 * The ARN(s) of the AWS log stream(s).
 *
 * @example ["arn:aws:logs:us-west-1:123456789012:log-group:/aws/my/group:log-stream:logs/main/10838bed-421f-43ef-870a-f43feacbbb5b"]
 *
 * @note See the [log stream ARN format documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/iam-access-control-overview-cwl.html#CWL_ARN_Format). One log group can contain several log streams, so these ARNs necessarily identify both a log group and a log stream.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_LOG_STREAM_ARNS = 'aws.log.stream.arns';
/**
 * The name(s) of the AWS log stream(s) an application is writing to.
 *
 * @example ["logs/main/10838bed-421f-43ef-870a-f43feacbbb5b"]
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_AWS_LOG_STREAM_NAMES = 'aws.log.stream.names';
/**
 * The cloud account ID the resource is assigned to.
 *
 * @example 111111111111
 * @example opentelemetry
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_CLOUD_ACCOUNT_ID = 'cloud.account.id';
/**
 * Cloud regions often have multiple, isolated locations known as zones to increase availability. Availability zone represents the zone where the resource is running.
 *
 * @example us-east-1c
 *
 * @note Availability zones are called "zones" on Alibaba Cloud and Google Cloud.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_CLOUD_AVAILABILITY_ZONE = 'cloud.availability_zone';
/**
 * The cloud platform in use.
 *
 * @note The prefix of the service **SHOULD** match the one specified in `cloud.provider`.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_CLOUD_PLATFORM = 'cloud.platform';
/**
 * Name of the cloud provider.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_CLOUD_PROVIDER = 'cloud.provider';
/**
 * The geographical region the resource is running.
 *
 * @example us-central1
 * @example us-east-1
 *
 * @note Refer to your provider's docs to see the available regions, for example [Alibaba Cloud regions](https://www.alibabacloud.com/help/doc-detail/40654.htm), [AWS regions](https://aws.amazon.com/about-aws/global-infrastructure/regions_az/), [Azure regions](https://azure.microsoft.com/global-infrastructure/geographies/), [Google Cloud regions](https://cloud.google.com/about/locations), or [Tencent Cloud regions](https://www.tencentcloud.com/document/product/213/6091).
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_CLOUD_REGION = 'cloud.region';
/**
 * Cloud provider-specific native identifier of the monitored cloud resource (e.g. an [ARN](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html) on AWS, a [fully qualified resource ID](https://learn.microsoft.com/rest/api/resources/resources/get-by-id) on Azure, a [full resource name](https://cloud.google.com/apis/design/resource_names#full_resource_name) on GCP)
 *
 * @example arn:aws:lambda:REGION:ACCOUNT_ID:function:my-function
 * @example //run.googleapis.com/projects/PROJECT_ID/locations/LOCATION_ID/services/SERVICE_ID
 * @example /subscriptions/<SUBSCRIPTION_GUID>/resourceGroups/<RG>/providers/Microsoft.Web/sites/<FUNCAPP>/functions/<FUNC>
 *
 * @note On some cloud providers, it may not be possible to determine the full ID at startup,
 * so it may be necessary to set `cloud.resource_id` as a span attribute instead.
 *
 * The exact value to use for `cloud.resource_id` depends on the cloud provider.
 * The following well-known definitions **MUST** be used if you set this attribute and they apply:
 *
 *   - **AWS Lambda:** The function [ARN](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html).
 *     Take care not to use the "invoked ARN" directly but replace any
 *     [alias suffix](https://docs.aws.amazon.com/lambda/latest/dg/configuration-aliases.html)
 *     with the resolved function version, as the same runtime instance may be invocable with
 *     multiple different aliases.
 *   - **GCP:** The [URI of the resource](https://cloud.google.com/iam/docs/full-resource-names)
 *   - **Azure:** The [Fully Qualified Resource ID](https://docs.microsoft.com/rest/api/resources/resources/get-by-id) of the invoked function,
 *     *not* the function app, having the form
 *     `/subscriptions/<SUBSCRIPTION_GUID>/resourceGroups/<RG>/providers/Microsoft.Web/sites/<FUNCAPP>/functions/<FUNC>`.
 *     This means that a span attribute **MUST** be used, as an Azure function app can host multiple functions that would usually share
 *     a TracerProvider.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_CLOUD_RESOURCE_ID = 'cloud.resource_id';
/**
 * Container ID. Usually a UUID, as for example used to [identify Docker containers](https://docs.docker.com/engine/containers/run/#container-identification). The UUID might be abbreviated.
 *
 * @example a3bf90e006b2
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_CONTAINER_ID = 'container.id';
/**
 * Container name used by container runtime.
 *
 * @example opentelemetry-autoconf
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_CONTAINER_NAME = 'container.name';
/**
 * The name of the single function that this runtime instance executes.
 *
 * @example my-function
 * @example myazurefunctionapp/some-function-name
 *
 * @note This is the name of the function as configured/deployed on the FaaS
 * platform and is usually different from the name of the callback
 * function (which may be stored in the
 * [`code.namespace`/`code.function`](/docs/general/attributes.md#source-code-attributes)
 * span attributes).
 *
 * For some cloud providers, the above definition is ambiguous. The following
 * definition of function name **MUST** be used for this attribute
 * (and consequently the span name) for the listed cloud providers/products:
 *
 *   - **Azure:**  The full name `<FUNCAPP>/<FUNC>`, i.e., function app name
 *     followed by a forward slash followed by the function name (this form
 *     can also be seen in the resource JSON for the function).
 *     This means that a span attribute **MUST** be used, as an Azure function
 *     app can host multiple functions that would usually share
 *     a TracerProvider (see also the `cloud.resource_id` attribute).
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_FAAS_NAME = 'faas.name';
/**
 * The execution environment ID as a string, that will be potentially reused for other invocations to the same function/function version.
 *
 * @example 2021/06/28/[$LATEST]2f399eb14537447da05ab2a2e39309de
 *
 * @note * **AWS Lambda:** Use the (full) log stream name.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_FAAS_INSTANCE = 'faas.instance';
/**
 * The amount of memory available to the serverless function converted to Bytes.
 *
 * @example 134217728
 *
 * @note It's recommended to set this attribute since e.g. too little memory can easily stop a Java AWS Lambda function from working correctly. On AWS Lambda, the environment variable `AWS_LAMBDA_FUNCTION_MEMORY_SIZE` provides this information (which must be multiplied by 1,048,576).
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_FAAS_MAX_MEMORY = 'faas.max_memory';
/**
 * The immutable version of the function being executed.
 *
 * @example 26
 * @example pinkfroid-00002
 *
 * @note Depending on the cloud provider and platform, use:
 *
 *   - **AWS Lambda:** The [function version](https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html)
 *     (an integer represented as a decimal string).
 *   - **Google Cloud Run (Services):** The [revision](https://cloud.google.com/run/docs/managing/revisions)
 *     (i.e., the function name plus the revision suffix).
 *   - **Google Cloud Functions:** The value of the
 *     [`K_REVISION` environment variable](https://cloud.google.com/functions/docs/env-var#runtime_environment_variables_set_automatically).
 *   - **Azure Functions:** Not applicable. Do not set this attribute.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_FAAS_VERSION = 'faas.version';
/**
 * Unique host ID. For Cloud, this must be the instance_id assigned by the cloud provider. For non-containerized systems, this should be the `machine-id`. See the table below for the sources to use to determine the `machine-id` based on operating system.
 *
 * @example fdbf79e8af94cb7f9e8df36789187052
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_HOST_ID = 'host.id';
/**
 * Name of the host. On Unix systems, it may contain what the hostname command returns, or the fully qualified hostname, or another name specified by the user.
 *
 * @example opentelemetry-test
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_HOST_NAME = 'host.name';
/**
 * Type of host. For Cloud, this must be the machine type.
 *
 * @example n1-standard-1
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_HOST_TYPE = 'host.type';
/**
 * The name of the cluster.
 *
 * @example opentelemetry-cluster
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_K8S_CLUSTER_NAME = 'k8s.cluster.name';
/**
 * The string ID of the service instance.
 *
 * @example 627cc493-f310-47de-96bd-71410b7dec09
 *
 * @note **MUST** be unique for each instance of the same `service.namespace,service.name` pair (in other words
 * `service.namespace,service.name,service.instance.id` triplet **MUST** be globally unique). The ID helps to
 * distinguish instances of the same service that exist at the same time (e.g. instances of a horizontally scaled
 * service).
 *
 * Implementations, such as SDKs, are recommended to generate a random Version 1 or Version 4 [RFC
 * 4122](https://www.ietf.org/rfc/rfc4122.txt) UUID, but are free to use an inherent unique ID as the source of
 * this value if stability is desirable. In that case, the ID **SHOULD** be used as source of a UUID Version 5 and
 * **SHOULD** use the following UUID as the namespace: `4d63009a-8d0f-11ee-aad7-4c796ed8e320`.
 *
 * UUIDs are typically recommended, as only an opaque value for the purposes of identifying a service instance is
 * needed. Similar to what can be seen in the man page for the
 * [`/etc/machine-id`](https://www.freedesktop.org/software/systemd/man/machine-id.html) file, the underlying
 * data, such as pod name and namespace should be treated as confidential, being the user's choice to expose it
 * or not via another resource attribute.
 *
 * For applications running behind an application server (like unicorn), we do not recommend using one identifier
 * for all processes participating in the application. Instead, it's recommended each division (e.g. a worker
 * thread in unicorn) to have its own instance.id.
 *
 * It's not recommended for a Collector to set `service.instance.id` if it can't unambiguously determine the
 * service instance that is generating that telemetry. For instance, creating an UUID based on `pod.name` will
 * likely be wrong, as the Collector might not know from which container within that pod the telemetry originated.
 * However, Collectors can set the `service.instance.id` if they can unambiguously determine the service instance
 * for that telemetry. This is typically the case for scraping receivers, as they know the target address and
 * port.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_SERVICE_INSTANCE_ID = 'service.instance.id';
/**
 * A namespace for `service.name`.
 *
 * @example Shop
 *
 * @note A string value having a meaning that helps to distinguish a group of services, for example the team name that owns a group of services. `service.name` is expected to be unique within the same namespace. If `service.namespace` is not specified in the Resource then `service.name` is expected to be unique for all services that have no explicit namespace defined (so the empty/unspecified namespace is simply one more valid namespace). Zero-length namespace string is assumed equal to unspecified namespace.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
exports.ATTR_SERVICE_NAMESPACE = 'service.namespace';
/**
 * Enum value "aws_ec2" for attribute {@link ATTR_CLOUD_PLATFORM}.
 */
exports.CLOUD_PLATFORM_VALUE_AWS_EC2 = 'aws_ec2';
/**
 * Enum value "aws_ecs" for attribute {@link ATTR_CLOUD_PLATFORM}.
 */
exports.CLOUD_PLATFORM_VALUE_AWS_ECS = 'aws_ecs';
/**
 * Enum value "aws_eks" for attribute {@link ATTR_CLOUD_PLATFORM}.
 */
exports.CLOUD_PLATFORM_VALUE_AWS_EKS = 'aws_eks';
/**
 * Enum value "aws_elastic_beanstalk" for attribute {@link ATTR_CLOUD_PLATFORM}.
 */
exports.CLOUD_PLATFORM_VALUE_AWS_ELASTIC_BEANSTALK = 'aws_elastic_beanstalk';
/**
 * Enum value "aws_lambda" for attribute {@link ATTR_CLOUD_PLATFORM}.
 */
exports.CLOUD_PLATFORM_VALUE_AWS_LAMBDA = 'aws_lambda';
/**
 * Enum value "aws" for attribute {@link ATTR_CLOUD_PROVIDER}.
 */
exports.CLOUD_PROVIDER_VALUE_AWS = 'aws';
//# sourceMappingURL=semconv.js.map