"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = require("fs");
const shared_1 = require("./shared");
const utils_1 = require("../utils");
const user_interface_1 = __importDefault(require("../user-interface"));
const debug = (0, debug_1.default)('devcert:platforms:windows');
let encryptionKey;
class WindowsPlatform {
    constructor() {
        this.HOST_FILE_PATH = 'C:\\Windows\\System32\\Drivers\\etc\\hosts';
    }
    /**
     * Windows is at least simple. Like macOS, most applications will delegate to
     * the system trust store, which is updated with the confusingly named
     * `certutil` exe (not the same as the NSS/Mozilla certutil). Firefox does it's
     * own thing as usual, and getting a copy of NSS certutil onto the Windows
     * machine to try updating the Firefox store is basically a nightmare, so we
     * don't even try it - we just bail out to the GUI.
     */
    async addToTrustStores(certificatePath, options = {}) {
        // IE, Chrome, system utils
        debug('adding devcert root to Windows OS trust store');
        try {
            (0, utils_1.run)('certutil', ['-addstore', '-user', 'root', certificatePath]);
        }
        catch (e) {
            e.output.map((buffer) => {
                if (buffer) {
                    console.log(buffer.toString());
                }
            });
        }
        debug('adding devcert root to Firefox trust store');
        // Firefox (don't even try NSS certutil, no easy install for Windows)
        try {
            await (0, shared_1.openCertificateInFirefox)('start firefox', certificatePath);
        }
        catch (_a) {
            debug('Error opening Firefox, most likely Firefox is not installed');
        }
    }
    removeFromTrustStores(certificatePath) {
        debug('removing devcert root from Windows OS trust store');
        try {
            console.warn('Removing old certificates from trust stores. You may be prompted to grant permission for this. It\'s safe to delete old devcert certificates.');
            (0, utils_1.run)('certutil', ['-delstore', '-user', 'root', 'devcert']);
        }
        catch (e) {
            debug(`failed to remove ${certificatePath} from Windows OS trust store, continuing. ${e.toString()}`);
        }
    }
    async addDomainToHostFileIfMissing(domain) {
        let hostsFileContents = (0, fs_1.readFileSync)(this.HOST_FILE_PATH, 'utf8');
        if (!hostsFileContents.includes(domain)) {
            await (0, utils_1.sudo)(`echo 127.0.0.1  ${domain} >> ${this.HOST_FILE_PATH}`);
        }
    }
    deleteProtectedFiles(filepath) {
        (0, shared_1.assertNotTouchingFiles)(filepath, 'delete');
        (0, fs_1.rmSync)(filepath, { force: true, recursive: true });
    }
    async readProtectedFile(filepath) {
        (0, shared_1.assertNotTouchingFiles)(filepath, 'read');
        if (!encryptionKey) {
            encryptionKey = await user_interface_1.default.getWindowsEncryptionPassword();
        }
        // Try to decrypt the file
        try {
            return this.decrypt((0, fs_1.readFileSync)(filepath, 'utf8'), encryptionKey);
        }
        catch (e) {
            // If it's a bad password, clear the cached copy and retry
            if (e.message.indexOf('bad decrypt') >= -1) {
                encryptionKey = null;
                return await this.readProtectedFile(filepath);
            }
            throw e;
        }
    }
    async writeProtectedFile(filepath, contents) {
        (0, shared_1.assertNotTouchingFiles)(filepath, 'write');
        if (!encryptionKey) {
            encryptionKey = await user_interface_1.default.getWindowsEncryptionPassword();
        }
        let encryptedContents = this.encrypt(contents, encryptionKey);
        (0, fs_1.writeFileSync)(filepath, encryptedContents);
    }
    encrypt(text, key) {
        let cipher = crypto_1.default.createCipher('aes256', new Buffer(key));
        return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    }
    decrypt(encrypted, key) {
        let decipher = crypto_1.default.createDecipher('aes256', new Buffer(key));
        return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
    }
}
exports.default = WindowsPlatform;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luMzIuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBsYXRmb3Jtcy93aW4zMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtEQUFnQztBQUNoQyxvREFBNEI7QUFDNUIsMkJBQWdGO0FBRWhGLHFDQUE0RTtBQUU1RSxvQ0FBcUM7QUFDckMsdUVBQW1DO0FBRW5DLE1BQU0sS0FBSyxHQUFHLElBQUEsZUFBVyxFQUFDLDJCQUEyQixDQUFDLENBQUM7QUFFdkQsSUFBSSxhQUFxQixDQUFDO0FBRTFCLE1BQXFCLGVBQWU7SUFBcEM7UUFFVSxtQkFBYyxHQUFHLDRDQUE0QyxDQUFDO0lBMEZ4RSxDQUFDO0lBeEZDOzs7Ozs7O09BT0c7SUFDSCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsZUFBdUIsRUFBRSxVQUFtQixFQUFFO1FBQ25FLDJCQUEyQjtRQUMzQixLQUFLLENBQUMsK0NBQStDLENBQUMsQ0FBQTtRQUN0RCxJQUFJLENBQUM7WUFDSCxJQUFBLFdBQUcsRUFBQyxVQUFVLEVBQUUsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDO1FBQ25FLENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ1gsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFjLEVBQUUsRUFBRTtnQkFDOUIsSUFBSSxNQUFNLEVBQUUsQ0FBQztvQkFDWCxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUNqQyxDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0QsS0FBSyxDQUFDLDRDQUE0QyxDQUFDLENBQUE7UUFDbkQscUVBQXFFO1FBQ3JFLElBQUksQ0FBQztZQUNILE1BQU0sSUFBQSxpQ0FBd0IsRUFBQyxlQUFlLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUFDLFdBQU0sQ0FBQztZQUNQLEtB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QUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVPLE9BQU8sQ0FBQyxTQUFpQixFQUFFLEdBQVc7UUFDNUMsSUFBSSxRQUFRLEdBQUcsZ0JBQU0sQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDaEUsT0FBTyxRQUFRLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM1RSxDQUFDO0NBRUY7QUE1RkQsa0NBNEZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGNyZWF0ZURlYnVnIGZyb20gJ2RlYnVnJztcbmltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IHJtU3luYyBhcyBybSwgd3JpdGVGaWxlU3luYyBhcyB3cml0ZSwgcmVhZEZpbGVTeW5jIGFzIHJlYWQgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBPcHRpb25zIH0gZnJvbSAnLi4vaW5kZXgnO1xuaW1wb3J0IHsgYXNzZXJ0Tm90VG91Y2hpbmdGaWxlcywgb3BlbkNlcnRpZmljYXRlSW5GaXJlZm94IH0gZnJvbSAnLi9zaGFyZWQnO1xuaW1wb3J0IHsgUGxhdGZvcm0gfSBmcm9tICcuJztcbmltcG9ydCB7IHJ1biwgc3VkbyB9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCBVSSBmcm9tICcuLi91c2VyLWludGVyZmFjZSc7XG5cbmNvbnN0IGRlYnVnID0gY3JlYXRlRGVidWcoJ2RldmNlcnQ6cGxhdGZvcm1zOndpbmRvd3MnKTtcblxubGV0IGVuY3J5cHRpb25LZXk6IHN0cmluZztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV2luZG93c1BsYXRmb3JtIGltcGxlbWVudHMgUGxhdGZvcm0ge1xuXG4gIHByaXZhdGUgSE9TVF9GSUxFX1BBVEggPSAnQzpcXFxcV2luZG93c1xcXFxTeXN0ZW0zMlxcXFxEcml2ZXJzXFxcXGV0Y1xcXFxob3N0cyc7XG5cbiAgLyoqXG4gICAqIFdpbmRvd3MgaXMgYXQgbGVhc3Qgc2ltcGxlLiBMaWtlIG1hY09TLCBtb3N0IGFwcGxpY2F0aW9ucyB3aWxsIGRlbGVnYXRlIHRvXG4gICAqIHRoZSBzeXN0ZW0gdHJ1c3Qgc3RvcmUsIHdoaWNoIGlzIHVwZGF0ZWQgd2l0aCB0aGUgY29uZnVzaW5nbHkgbmFtZWRcbiAgICogYGNlcnR1dGlsYCBleGUgKG5vdCB0aGUgc2FtZSBhcyB0aGUgTlNTL01vemlsbGEgY2VydHV0aWwpLiBGaXJlZm94IGRvZXMgaXQnc1xuICAgKiBvd24gdGhpbmcgYXMgdXN1YWwsIGFuZCBnZXR0aW5nIGEgY29weSBvZiBOU1MgY2VydHV0aWwgb250byB0aGUgV2luZG93c1xuICAgKiBtYWNoaW5lIHRvIHRyeSB1cGRhdGluZyB0aGUgRmlyZWZveCBzdG9yZSBpcyBiYXNpY2FsbHkgYSBuaWdodG1hcmUsIHNvIHdlXG4gICAqIGRvbid0IGV2ZW4gdHJ5IGl0IC0gd2UganVzdCBiYWlsIG91dCB0byB0aGUgR1VJLlxuICAgKi9cbiAgYXN5bmMgYWRkVG9UcnVzdFN0b3JlcyhjZXJ0aWZpY2F0ZVBhdGg6IHN0cmluZywgb3B0aW9uczogT3B0aW9ucyA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gSUUsIENocm9tZSwgc3lzdGVtIHV0aWxzXG4gICAgZGVidWcoJ2FkZGluZyBkZXZjZXJ0IHJvb3QgdG8gV2luZG93cyBPUyB0cnVzdCBzdG9yZScpXG4gICAgdHJ5IHtcbiAgICAgIHJ1bignY2VydHV0aWwnLCBbJy1hZGRzdG9yZScsICctdXNlcicsICdyb290JywgY2VydGlmaWNhdGVQYXRoXSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZS5vdXRwdXQubWFwKChidWZmZXI6IEJ1ZmZlcikgPT4ge1xuICAgICAgICBpZiAoYnVmZmVyKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYnVmZmVyLnRvU3RyaW5nKCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgZGVidWcoJ2FkZGluZyBkZXZjZXJ0IHJvb3QgdG8gRmlyZWZveCB0cnVzdCBzdG9yZScpXG4gICAgLy8gRmlyZWZveCAoZG9uJ3QgZXZlbiB0cnkgTlNTIGNlcnR1dGlsLCBubyBlYXN5IGluc3RhbGwgZm9yIFdpbmRvd3MpXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IG9wZW5DZXJ0aWZpY2F0ZUluRmlyZWZveCgnc3RhcnQgZmlyZWZveCcsIGNlcnRpZmljYXRlUGF0aCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBkZWJ1ZygnRXJyb3Igb3BlbmluZyBGaXJlZm94LCBtb3N0IGxpa2VseSBGaXJlZm94IGlzIG5vdCBpbnN0YWxsZWQnKTtcbiAgICB9XG4gIH1cbiAgXG4gIHJlbW92ZUZyb21UcnVzdFN0b3JlcyhjZXJ0aWZpY2F0ZVBhdGg6IHN0cmluZykge1xuICAgIGRlYnVnKCdyZW1vdmluZyBkZXZjZXJ0IHJvb3QgZnJvbSBXaW5kb3dzIE9TIHRydXN0IHN0b3JlJyk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUud2FybignUmVtb3Zpbmcgb2xkIGNlcnRpZmljYXRlcyBmcm9tIHRydXN0IHN0b3Jlcy4gWW91IG1heSBiZSBwcm9tcHRlZCB0byBncmFudCBwZXJtaXNzaW9uIGZvciB0aGlzLiBJdFxcJ3Mgc2FmZSB0byBkZWxldGUgb2xkIGRldmNlcnQgY2VydGlmaWNhdGVzLicpO1xuICAgICAgcnVuKCdjZXJ0dXRpbCcsIFsnLWRlbHN0b3JlJywgJy11c2VyJywgJ3Jvb3QnLCAnZGV2Y2VydCddKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBkZWJ1ZyhgZmFpbGVkIHRvIHJlbW92ZSAkeyBjZXJ0aWZpY2F0ZVBhdGggfSBmcm9tIFdpbmRvd3MgT1MgdHJ1c3Qgc3RvcmUsIGNvbnRpbnVpbmcuICR7IGUudG9TdHJpbmcoKSB9YClcbiAgICB9XG4gIH1cblxuICBhc3luYyBhZGREb21haW5Ub0hvc3RGaWxlSWZNaXNzaW5nKGRvbWFpbjogc3RyaW5nKSB7XG4gICAgbGV0IGhvc3RzRmlsZUNvbnRlbnRzID0gcmVhZCh0aGlzLkhPU1RfRklMRV9QQVRILCAndXRmOCcpO1xuICAgIGlmICghaG9zdHNGaWxlQ29udGVudHMuaW5jbHVkZXMoZG9tYWluKSkge1xuICAgICAgYXdhaXQgc3VkbyhgZWNobyAxMjcuMC4wLjEgICR7IGRvbWFpbiB9ID4+ICR7IHRoaXMuSE9TVF9GSUxFX1BBVEggfWApO1xuICAgIH1cbiAgfVxuICBcbiAgZGVsZXRlUHJvdGVjdGVkRmlsZXMoZmlsZXBhdGg6IHN0cmluZykge1xuICAgIGFzc2VydE5vdFRvdWNoaW5nRmlsZXMoZmlsZXBhdGgsICdkZWxldGUnKTtcbiAgICBybShmaWxlcGF0aCwgeyBmb3JjZTogdHJ1ZSwgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICB9XG5cbiAgYXN5bmMgcmVhZFByb3RlY3RlZEZpbGUoZmlsZXBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgYXNzZXJ0Tm90VG91Y2hpbmdGaWxlcyhmaWxlcGF0aCwgJ3JlYWQnKTtcbiAgICBpZiAoIWVuY3J5cHRpb25LZXkpIHtcbiAgICAgIGVuY3J5cHRpb25LZXkgPSBhd2FpdCBVSS5nZXRXaW5kb3dzRW5jcnlwdGlvblBhc3N3b3JkKCk7XG4gICAgfVxuICAgIC8vIFRyeSB0byBkZWNyeXB0IHRoZSBmaWxlXG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLmRlY3J5cHQocmVhZChmaWxlcGF0aCwgJ3V0ZjgnKSwgZW5jcnlwdGlvbktleSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gSWYgaXQncyBhIGJhZCBwYXNzd29yZCwgY2xlYXIgdGhlIGNhY2hlZCBjb3B5IGFuZCByZXRyeVxuICAgICAgaWYgKGUubWVzc2FnZS5pbmRleE9mKCdiYWQgZGVjcnlwdCcpID49IC0xKSB7XG4gICAgICAgIGVuY3J5cHRpb25LZXkgPSBudWxsO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5yZWFkUHJvdGVjdGVkRmlsZShmaWxlcGF0aCk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHdyaXRlUHJvdGVjdGVkRmlsZShmaWxlcGF0aDogc3RyaW5nLCBjb250ZW50czogc3RyaW5nKSB7XG4gICAgYXNzZXJ0Tm90VG91Y2hpbmdGaWxlcyhmaWxlcGF0aCwgJ3dyaXRlJyk7XG4gICAgaWYgKCFlbmNyeXB0aW9uS2V5KSB7XG4gICAgICBlbmNyeXB0aW9uS2V5ID0gYXdhaXQgVUkuZ2V0V2luZG93c0VuY3J5cHRpb25QYXNzd29yZCgpO1xuICAgIH1cbiAgICBsZXQgZW5jcnlwdGVkQ29udGVudHMgPSB0aGlzLmVuY3J5cHQoY29udGVudHMsIGVuY3J5cHRpb25LZXkpO1xuICAgIHdyaXRlKGZpbGVwYXRoLCBlbmNyeXB0ZWRDb250ZW50cyk7XG4gIH1cblxuICBwcml2YXRlIGVuY3J5cHQodGV4dDogc3RyaW5nLCBrZXk6IHN0cmluZykge1xuICAgIGxldCBjaXBoZXIgPSBjcnlwdG8uY3JlYXRlQ2lwaGVyKCdhZXMyNTYnLCBuZXcgQnVmZmVyKGtleSkpO1xuICAgIHJldHVybiBjaXBoZXIudXBkYXRlKHRleHQsICd1dGY4JywgJ2hleCcpICsgY2lwaGVyLmZpbmFsKCdoZXgnKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVjcnlwdChlbmNyeXB0ZWQ6IHN0cmluZywga2V5OiBzdHJpbmcpIHtcbiAgICBsZXQgZGVjaXBoZXIgPSBjcnlwdG8uY3JlYXRlRGVjaXBoZXIoJ2FlczI1NicsIG5ldyBCdWZmZXIoa2V5KSk7XG4gICAgcmV0dXJuIGRlY2lwaGVyLnVwZGF0ZShlbmNyeXB0ZWQsICdoZXgnLCAndXRmOCcpICsgZGVjaXBoZXIuZmluYWwoJ3V0ZjgnKTtcbiAgfVxuXG59XG4iXX0=