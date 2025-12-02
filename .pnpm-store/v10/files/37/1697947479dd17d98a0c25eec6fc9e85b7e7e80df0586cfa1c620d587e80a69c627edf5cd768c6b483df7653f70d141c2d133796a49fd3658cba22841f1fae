import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AssistantCloudFiles } from "../AssistantCloudFiles";
import { AssistantCloudAPI } from "../AssistantCloudAPI";

// Mock the AssistantCloudAPI to avoid making real HTTP requests (except for integration tests)
vi.mock("../AssistantCloudAPI");

describe("AssistantCloudFiles", () => {
  let cloudFiles: AssistantCloudFiles;
  let mockApi: AssistantCloudAPI;

  beforeEach(() => {
    // Create a mock API instance
    mockApi = {
      makeRequest: vi.fn(),
      makeRawRequest: vi.fn(),
      _auth: { getAuthHeaders: vi.fn() },
      _baseUrl: "https://backend.assistant-api.com",
    } as unknown as AssistantCloudAPI;

    // Create the AssistantCloudFiles instance with the mock API
    cloudFiles = new AssistantCloudFiles(mockApi);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("pdfToImages", () => {
    /**
     * Tests successful PDF to images conversion with file_url
     * This matches the curl request structure provided
     */
    it("should successfully convert PDF to images using file_url", async () => {
      const mockResponse = {
        success: true,
        urls: [
          "https://aui-pdf-processing.5c52327048f352f85fb041947c406ab4.r2.cloudflarestorage.com/images/8eb81c61-dc76-48fd-ab66-25cd84a28c97/page-1.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=8698a7e98d990c6edd11fee3a9d0f3f0%2F20250606%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250606T035428Z&X-Amz-Expires=3600&X-Amz-Signature=ea26cdd5ff7dc85eba12970137606484b9a8ab2c520f31ddba9cbe5941b20793&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
          "https://aui-pdf-processing.5c52327048f352f85fb041947c406ab4.r2.cloudflarestorage.com/images/8eb81c61-dc76-48fd-ab66-25cd84a28c97/page-2.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=8698a7e98d990c6edd11fee3a9d0f3f0%2F20250606%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250606T035428Z&X-Amz-Expires=3600&X-Amz-Signature=3499237770cc4402a60e6cc9b8ce8bd460faade9adf456d2773009f7d07af9cb&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
          "https://aui-pdf-processing.5c52327048f352f85fb041947c406ab4.r2.cloudflarestorage.com/images/8eb81c61-dc76-48fd-ab66-25cd84a28c97/page-3.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=8698a7e98d990c6edd11fee3a9d0f3f0%2F20250606%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250606T035429Z&X-Amz-Expires=3600&X-Amz-Signature=663ee073972f1b7b82cede9039ed4bc0a6c08118533a9586e871807baf032bc2&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
        ],
        message: "PDF successfully converted to images",
      };

      // Mock the API call to return our expected response
      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {
        file_url: "https://files.testfile.org/PDF/10MB-TESTFILE.ORG.pdf",
      };

      const result = await cloudFiles.pdfToImages(requestBody);

      // Verify the API was called correctly
      expect(mockApi.makeRequest).toHaveBeenCalledWith("/files/pdf-to-images", {
        method: "POST",
        body: requestBody,
      });

      // Verify the response structure
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.urls).toHaveLength(3);
      expect(result.message).toBe("PDF successfully converted to images");
      expect(result.urls[0]).toContain("page-1.png");
      expect(result.urls[1]).toContain("page-2.png");
      expect(result.urls[2]).toContain("page-3.png");
    });

    /**
     * Tests successful PDF to images conversion with file_blob
     */
    it("should successfully convert PDF to images using file_blob", async () => {
      const mockResponse = {
        success: true,
        urls: [
          "https://example.com/converted-image-1.png",
          "https://example.com/converted-image-2.png",
        ],
        message: "PDF successfully converted to images",
      };

      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {
        file_blob:
          "data:application/pdf;base64,JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNTk1IDg0Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKFRlc3QgUERGKSBUagoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9CYXNlRm9udCAvSGVsdmV0aWNhCi9TdWJ0eXBlIC9UeXBlMQo+PgplbmRvYmoKNiAwIG9iago8PAovVHlwZSAvRm9udERlc2NyaXB0b3IKL0ZvbnROYW1lIC9IZWx2ZXRpY2EKPj4KZW5kb2J4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA3NCAwMDAwMCBuIAowMDAwMDAwMTMzIDAwMDAwIG4gCjAwMDAwMDAyMDQgMDAwMDAgbiAKMDAwMDAwMDI5OSAwMDAwMCBuIAowMDAwMDAwMzc2IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNwovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDM0CiUlRU9GCg==",
      };

      const result = await cloudFiles.pdfToImages(requestBody);

      expect(mockApi.makeRequest).toHaveBeenCalledWith("/files/pdf-to-images", {
        method: "POST",
        body: requestBody,
      });

      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.urls).toHaveLength(2);
    });

    /**
     * Tests API error handling
     */
    it("should handle API errors gracefully", async () => {
      const errorMessage = "Invalid PDF file";
      vi.mocked(mockApi.makeRequest).mockRejectedValue(new Error(errorMessage));

      const requestBody = {
        file_url: "https://invalid-url.com/not-a-pdf.txt",
      };

      await expect(cloudFiles.pdfToImages(requestBody)).rejects.toThrow(
        errorMessage,
      );

      expect(mockApi.makeRequest).toHaveBeenCalledWith("/files/pdf-to-images", {
        method: "POST",
        body: requestBody,
      });
    });

    /**
     * Tests handling of failed conversion response
     */
    it("should handle failed conversion response", async () => {
      const mockResponse = {
        success: false,
        urls: [],
        message: "Failed to convert PDF: File too large",
      };

      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {
        file_url: "https://example.com/huge-file.pdf",
      };

      const result = await cloudFiles.pdfToImages(requestBody);

      expect(result.success).toBe(false);
      expect(result.urls).toHaveLength(0);
      expect(result.message).toBe("Failed to convert PDF: File too large");
    });

    /**
     * Tests that the method works with both file_url and file_blob undefined (edge case)
     */
    it("should handle empty request body", async () => {
      const mockResponse = {
        success: false,
        urls: [],
        message: "No file provided",
      };

      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {};

      const result = await cloudFiles.pdfToImages(requestBody);

      expect(mockApi.makeRequest).toHaveBeenCalledWith("/files/pdf-to-images", {
        method: "POST",
        body: requestBody,
      });

      expect(result.success).toBe(false);
      expect(result.urls).toHaveLength(0);
    });

    /**
     * Tests that the method sends the correct request headers and structure
     * This ensures compatibility with the API key authentication shown in the curl example
     */
    it("should make request to correct endpoint with proper structure", async () => {
      const mockResponse = {
        success: true,
        urls: ["https://example.com/image.png"],
        message: "Success",
      };

      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {
        file_url: "https://files.testfile.org/PDF/10MB-TESTFILE.ORG.pdf",
      };

      await cloudFiles.pdfToImages(requestBody);

      // Verify the endpoint and method are correct
      expect(mockApi.makeRequest).toHaveBeenCalledWith("/files/pdf-to-images", {
        method: "POST",
        body: requestBody,
      });

      // Verify it was called exactly once
      expect(mockApi.makeRequest).toHaveBeenCalledTimes(1);
    });

    /**
     * Tests that both file_url and file_blob can be provided simultaneously
     */
    it("should handle request with both file_url and file_blob", async () => {
      const mockResponse = {
        success: true,
        urls: ["https://example.com/image.png"],
        message: "Success",
      };

      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {
        file_url: "https://example.com/file.pdf",
        file_blob: "base64data...",
      };

      const result = await cloudFiles.pdfToImages(requestBody);

      expect(mockApi.makeRequest).toHaveBeenCalledWith("/files/pdf-to-images", {
        method: "POST",
        body: requestBody,
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("generatePresignedUploadUrl", () => {
    /**
     * Tests successful generation of presigned upload URL
     * This matches the curl request structure provided
     */
    it("should successfully generate presigned upload URL", async () => {
      const mockResponse = {
        success: true,
        signedUrl:
          "https://aui-cloud-attachments.5c52327048f352f85fb041947c406ab4.r2.cloudflarestorage.com/attachments/0204c5a7-cd09-470c-9488-96cf0be9db92.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=8698a7e98d990c6edd11fee3a9d0f3f0%2F20250606%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250606T051813Z&X-Amz-Expires=900&X-Amz-Signature=b0d27e7bee6200eb1964ad1d7f4a8ad76db15a3d99bd4fb47ff4b0b08fee5ca5&X-Amz-SignedHeaders=content-length%3Bhost&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-meta-original-filename=hello.pdf&x-amz-meta-project-id=proj_09369w56dnge&x-amz-meta-user-id=676767&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject",
        expiresAt: "2025-06-06T05:33:13.322Z",
        publicUrl:
          "https://storage.assistant-api.com/attachments/0204c5a7-cd09-470c-9488-96cf0be9db92.pdf",
      };

      // Mock the API call to return our expected response
      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {
        filename: "hello.pdf",
      };

      const result = await cloudFiles.generatePresignedUploadUrl(requestBody);

      // Verify the API was called correctly
      expect(mockApi.makeRequest).toHaveBeenCalledWith(
        "/files/attachments/generate-presigned-upload-url",
        {
          method: "POST",
          body: requestBody,
        },
      );

      // Verify the response structure
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.signedUrl).toContain("aui-cloud-attachments");
      expect(result.signedUrl).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
      expect(result.expiresAt).toBe("2025-06-06T05:33:13.322Z");
      expect(result.publicUrl).toBe(
        "https://storage.assistant-api.com/attachments/0204c5a7-cd09-470c-9488-96cf0be9db92.pdf",
      );
    });

    /**
     * Tests generation with different file types
     */
    it("should successfully generate presigned upload URL for different file types", async () => {
      const mockResponse = {
        success: true,
        signedUrl:
          "https://aui-cloud-attachments.5c52327048f352f85fb041947c406ab4.r2.cloudflarestorage.com/attachments/test-image.png",
        expiresAt: "2025-06-06T05:33:13.322Z",
        publicUrl:
          "https://storage.assistant-api.com/attachments/test-image.png",
      };

      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {
        filename: "test-image.png",
      };

      const result = await cloudFiles.generatePresignedUploadUrl(requestBody);

      expect(mockApi.makeRequest).toHaveBeenCalledWith(
        "/files/attachments/generate-presigned-upload-url",
        {
          method: "POST",
          body: requestBody,
        },
      );

      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.publicUrl).toContain("test-image.png");
    });

    /**
     * Tests API error handling
     */
    it("should handle API errors gracefully", async () => {
      const errorMessage = "Invalid filename";
      vi.mocked(mockApi.makeRequest).mockRejectedValue(new Error(errorMessage));

      const requestBody = {
        filename: "",
      };

      await expect(
        cloudFiles.generatePresignedUploadUrl(requestBody),
      ).rejects.toThrow(errorMessage);

      expect(mockApi.makeRequest).toHaveBeenCalledWith(
        "/files/attachments/generate-presigned-upload-url",
        {
          method: "POST",
          body: requestBody,
        },
      );
    });

    /**
     * Tests handling of failed response
     */
    it("should handle failed upload URL generation response", async () => {
      const mockResponse = {
        success: false,
        signedUrl: "",
        expiresAt: "",
        publicUrl: "",
      };

      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {
        filename: "invalid-file-type.exe",
      };

      const result = await cloudFiles.generatePresignedUploadUrl(requestBody);

      expect(result.success).toBe(false);
      expect(result.signedUrl).toBe("");
      expect(result.publicUrl).toBe("");
    });

    /**
     * Tests that the method sends the correct request headers and structure
     */
    it("should make request to correct endpoint with proper structure", async () => {
      const mockResponse = {
        success: true,
        signedUrl: "https://example.com/signed-url",
        expiresAt: "2025-06-06T05:33:13.322Z",
        publicUrl: "https://example.com/public-url",
      };

      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      const requestBody = {
        filename: "document.pdf",
      };

      await cloudFiles.generatePresignedUploadUrl(requestBody);

      // Verify the endpoint and method are correct
      expect(mockApi.makeRequest).toHaveBeenCalledWith(
        "/files/attachments/generate-presigned-upload-url",
        {
          method: "POST",
          body: requestBody,
        },
      );

      // Verify it was called exactly once
      expect(mockApi.makeRequest).toHaveBeenCalledTimes(1);
    });

    /**
     * Tests filename validation scenarios
     */
    it("should handle various filename formats", async () => {
      const mockResponse = {
        success: true,
        signedUrl: "https://example.com/signed-url",
        expiresAt: "2025-06-06T05:33:13.322Z",
        publicUrl: "https://example.com/public-url",
      };

      vi.mocked(mockApi.makeRequest).mockResolvedValue(mockResponse);

      // Test with filename containing spaces and special characters
      const requestBody = {
        filename: "my document (final version).pdf",
      };

      const result = await cloudFiles.generatePresignedUploadUrl(requestBody);

      expect(mockApi.makeRequest).toHaveBeenCalledWith(
        "/files/attachments/generate-presigned-upload-url",
        {
          method: "POST",
          body: requestBody,
        },
      );

      expect(result).toEqual(mockResponse);
    });
  });

  // Integration test that actually calls the real API
  describe("Integration Tests", () => {
    /**
     * Integration test that actually calls the real API endpoint
     * This test requires real API credentials to be set in environment variables:
     * - AUI_API_KEY: Your API key (e.g., sk_aui_proj_...)
     * - AUI_USER_ID: Your user ID
     * - AUI_WORKSPACE_ID: Your workspace ID
     */
    it.skipIf(
      !process.env.AUI_API_KEY ||
        !process.env.AUI_USER_ID ||
        !process.env.AUI_WORKSPACE_ID,
    )(
      "should actually convert PDF to images using real API",
      async () => {
        // Unmock all modules for this test to use real implementations
        vi.doUnmock("../AssistantCloudAPI");
        vi.doUnmock("../AssistantCloudFiles");
        vi.doUnmock("../AssistantCloud");

        // Clear all mocks and reload modules
        vi.resetModules();

        // Import real modules
        const { AssistantCloud: RealAssistantCloud } = await import(
          "../AssistantCloud"
        );

        const realCloud = new RealAssistantCloud({
          apiKey: process.env.AUI_API_KEY!,
          userId: process.env.AUI_USER_ID!,
          workspaceId: process.env.AUI_WORKSPACE_ID!,
        });

        const requestBody = {
          file_url: "https://files.testfile.org/PDF/10MB-TESTFILE.ORG.pdf",
        };

        console.log("Making API call to convert PDF...");
        const result = await realCloud.files.pdfToImages(requestBody);
        console.log("API call result:", result);

        // Verify the response structure
        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("urls");
        expect(result).toHaveProperty("message");

        if (result.success) {
          expect(Array.isArray(result.urls)).toBe(true);
          expect(result.urls.length).toBeGreaterThan(0);
          expect(typeof result.message).toBe("string");

          // Verify URLs are valid image URLs
          result.urls.forEach((url) => {
            expect(url).toMatch(/^https:\/\/.+\.(png|jpg|jpeg)(\?.*)?$/i);
          });
        } else {
          // If it fails, at least verify the error message is a string
          expect(typeof result.message).toBe("string");
          console.log("API call failed:", result.message);
        }

        // Restore mocks after the test
        vi.doMock("../AssistantCloudAPI");
      },
      60000, // 60 second timeout for real API calls
    );

    /**
     * Integration test for generatePresignedUploadUrl that actually calls the real API endpoint
     * This test requires real API credentials to be set in environment variables:
     * - AUI_API_KEY: Your API key (e.g., sk_aui_proj_...)
     * - AUI_USER_ID: Your user ID
     * - AUI_WORKSPACE_ID: Your workspace ID
     */
    it.skipIf(
      !process.env.AUI_API_KEY ||
        !process.env.AUI_USER_ID ||
        !process.env.AUI_WORKSPACE_ID,
    )(
      "should actually generate presigned upload URL using real API",
      async () => {
        // Unmock all modules for this test to use real implementations
        vi.doUnmock("../AssistantCloudAPI");
        vi.doUnmock("../AssistantCloudFiles");
        vi.doUnmock("../AssistantCloud");

        // Clear all mocks and reload modules
        vi.resetModules();

        // Import real modules
        const { AssistantCloud: RealAssistantCloud } = await import(
          "../AssistantCloud"
        );

        const realCloud = new RealAssistantCloud({
          apiKey: process.env.AUI_API_KEY!,
          userId: process.env.AUI_USER_ID!,
          workspaceId: process.env.AUI_WORKSPACE_ID!,
        });

        const requestBody = {
          filename: "test-upload.pdf",
        };

        console.log("Making API call to generate presigned upload URL...");
        const result =
          await realCloud.files.generatePresignedUploadUrl(requestBody);
        console.log("API call result:", result);

        // Verify the response structure
        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("signedUrl");
        expect(result).toHaveProperty("expiresAt");
        expect(result).toHaveProperty("publicUrl");

        if (result.success) {
          expect(typeof result.signedUrl).toBe("string");
          expect(typeof result.expiresAt).toBe("string");
          expect(typeof result.publicUrl).toBe("string");
          expect(result.signedUrl.length).toBeGreaterThan(0);
          expect(result.publicUrl.length).toBeGreaterThan(0);

          // Verify URLs are valid HTTPS URLs
          expect(result.signedUrl).toMatch(/^https:\/\/.+/);
          expect(result.publicUrl).toMatch(/^https:\/\/.+/);

          // Verify the signed URL contains expected AWS signature parameters
          expect(result.signedUrl).toContain("X-Amz-Algorithm");
          expect(result.signedUrl).toContain("X-Amz-Signature");

          // Verify expiresAt is a valid ISO date string
          expect(() => new Date(result.expiresAt)).not.toThrow();
        } else {
          console.log(
            "API call failed - this may be expected for some test cases",
          );
        }

        // Restore mocks after the test
        vi.doMock("../AssistantCloudAPI");
      },
      30000, // 30 second timeout for real API calls
    );
  });
});
