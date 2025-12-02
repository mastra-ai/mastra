/* eslint-disable import/no-extraneous-dependencies */
import { printVitestReporterTable } from "./utils/reporter.js";
import { importVitestModule } from "./utils/esm.mjs";
const vitestReporters = await importVitestModule("reporters");
const DefaultReporter = vitestReporters.DefaultReporter;
class LangSmithEvalReporter extends DefaultReporter {
    async onFinished(files, errors) {
        super.onFinished(files, errors);
        await printVitestReporterTable(files, this.ctx);
    }
}
export default LangSmithEvalReporter;
