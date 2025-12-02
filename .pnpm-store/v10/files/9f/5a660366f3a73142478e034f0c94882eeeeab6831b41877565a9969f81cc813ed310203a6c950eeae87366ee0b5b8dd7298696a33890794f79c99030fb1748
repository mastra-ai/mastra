import { APIResource } from "../../resource.js";
import * as ResponsesAPI from "./responses.js";
import { ResponseGetParams, ResponseGetResponse, Responses } from "./responses.js";
import * as ScansAPI from "./scans.js";
import { ScanBulkCreateParams, ScanBulkCreateResponse, ScanCreateParams, ScanCreateResponse, ScanDOMParams, ScanDOMResponse, ScanGetParams, ScanGetResponse, ScanHARParams, ScanHARResponse, ScanListParams, ScanListResponse, ScanScreenshotParams, Scans } from "./scans.js";
export declare class URLScanner extends APIResource {
    responses: ResponsesAPI.Responses;
    scans: ScansAPI.Scans;
}
export interface URLScannerDomain {
    id: number;
    name: string;
    super_category_id?: number;
}
export interface URLScannerTask {
    effectiveUrl: string;
    errors: Array<URLScannerTask.Error>;
    location: string;
    region: string;
    status: string;
    success: boolean;
    time: string;
    url: string;
    uuid: string;
    visibility: string;
}
export declare namespace URLScannerTask {
    interface Error {
        message: string;
    }
}
export declare namespace URLScanner {
    export { type URLScannerDomain as URLScannerDomain, type URLScannerTask as URLScannerTask };
    export { Responses as Responses, type ResponseGetResponse as ResponseGetResponse, type ResponseGetParams as ResponseGetParams, };
    export { Scans as Scans, type ScanCreateResponse as ScanCreateResponse, type ScanListResponse as ScanListResponse, type ScanBulkCreateResponse as ScanBulkCreateResponse, type ScanDOMResponse as ScanDOMResponse, type ScanGetResponse as ScanGetResponse, type ScanHARResponse as ScanHARResponse, type ScanCreateParams as ScanCreateParams, type ScanListParams as ScanListParams, type ScanBulkCreateParams as ScanBulkCreateParams, type ScanDOMParams as ScanDOMParams, type ScanGetParams as ScanGetParams, type ScanHARParams as ScanHARParams, type ScanScreenshotParams as ScanScreenshotParams, };
}
//# sourceMappingURL=url-scanner.d.ts.map