import { AssistantCloudAPI } from "./AssistantCloudAPI";
type PdfToImagesRequestBody = {
    file_blob?: string | undefined;
    file_url?: string | undefined;
};
type PdfToImagesResponse = {
    success: boolean;
    urls: string[];
    message: string;
};
type GeneratePresignedUploadUrlRequestBody = {
    filename: string;
};
type GeneratePresignedUploadUrlResponse = {
    success: boolean;
    signedUrl: string;
    expiresAt: string;
    publicUrl: string;
};
export declare class AssistantCloudFiles {
    private cloud;
    constructor(cloud: AssistantCloudAPI);
    pdfToImages(body: PdfToImagesRequestBody): Promise<PdfToImagesResponse>;
    generatePresignedUploadUrl(body: GeneratePresignedUploadUrlRequestBody): Promise<GeneratePresignedUploadUrlResponse>;
}
export {};
//# sourceMappingURL=AssistantCloudFiles.d.ts.map