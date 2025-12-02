import { createModulerModifier } from "../extensions/error-tracking/modifiers/module.node.mjs";
import { addSourceContext } from "../extensions/error-tracking/modifiers/context-lines.node.mjs";
import error_tracking from "../extensions/error-tracking/index.mjs";
import { PostHogBackendClient } from "../client.mjs";
import { ErrorTracking } from "@posthog/core";
export * from "../exports.mjs";
error_tracking.errorPropertiesBuilder = new ErrorTracking.ErrorPropertiesBuilder([
    new ErrorTracking.EventCoercer(),
    new ErrorTracking.ErrorCoercer(),
    new ErrorTracking.ObjectCoercer(),
    new ErrorTracking.StringCoercer(),
    new ErrorTracking.PrimitiveCoercer()
], [
    ErrorTracking.nodeStackLineParser
], [
    createModulerModifier(),
    addSourceContext
]);
class PostHog extends PostHogBackendClient {
    getLibraryId() {
        return 'posthog-node';
    }
}
export { PostHog };
