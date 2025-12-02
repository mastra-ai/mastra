import { uuidv7 } from "@posthog/core";
import error_tracking from "./error-tracking/index.mjs";
function setupExpressErrorHandler(_posthog, app) {
    app.use((error, _, __, next)=>{
        const hint = {
            mechanism: {
                type: 'middleware',
                handled: false
            }
        };
        error_tracking.buildEventMessage(error, hint, uuidv7(), {
            $process_person_profile: false
        }).then((msg)=>_posthog.capture(msg));
        next(error);
    });
}
export { setupExpressErrorHandler };
