"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const debug_1 = __importDefault(require("debug"));
const utils_1 = require("../utils");
const shared_1 = require("./shared");
const debug = (0, debug_1.default)('devcert:platforms:macos');
const getCertUtilPath = () => path_1.default.join((0, utils_1.run)('brew', ['--prefix', 'nss']).toString().trim(), 'bin', 'certutil');
class MacOSPlatform {
    constructor() {
        this.FIREFOX_BUNDLE_PATH = '/Applications/Firefox.app';
        this.FIREFOX_BIN_PATH = path_1.default.join(this.FIREFOX_BUNDLE_PATH, 'Contents/MacOS/firefox');
        this.FIREFOX_NSS_DIR = path_1.default.join(process.env.HOME, 'Library/Application Support/Firefox/Profiles/*');
        this.HOST_FILE_PATH = '/etc/hosts';
    }
    /**
     * macOS is pretty simple - just add the certificate to the system keychain,
     * and most applications will delegate to that for determining trusted
     * certificates. Firefox, of course, does it's own thing. We can try to
     * automatically install the cert with Firefox if we can use certutil via the
     * `nss` Homebrew package, otherwise we go manual with user-facing prompts.
     */
    async addToTrustStores(certificatePath, options = {}) {
        // Chrome, Safari, system utils
        debug('Adding devcert root CA to macOS system keychain');
        (0, utils_1.run)('sudo', [
            'security',
            'add-trusted-cert',
            '-d',
            '-r',
            'trustRoot',
            '-k',
            '/Library/Keychains/System.keychain',
            '-p',
            'ssl',
            '-p',
            'basic',
            certificatePath
        ]);
        if (this.isFirefoxInstalled()) {
            // Try to use certutil to install the cert automatically
            debug('Firefox install detected. Adding devcert root CA to Firefox trust store');
            if (!this.isNSSInstalled()) {
                if (!options.skipCertutilInstall) {
                    if ((0, utils_1.commandExists)('brew')) {
                        debug(`certutil is not already installed, but Homebrew is detected. Trying to install certutil via Homebrew...`);
                        try {
                            (0, utils_1.run)('brew', ['install', 'nss'], { stdio: 'ignore' });
                        }
                        catch (e) {
                            debug(`brew install nss failed`);
                        }
                    }
                    else {
                        debug(`Homebrew didn't work, so we can't try to install certutil. Falling back to manual certificate install`);
                        return await (0, shared_1.openCertificateInFirefox)(this.FIREFOX_BIN_PATH, certificatePath);
                    }
                }
                else {
                    debug(`certutil is not already installed, and skipCertutilInstall is true, so we have to fall back to a manual install`);
                    return await (0, shared_1.openCertificateInFirefox)(this.FIREFOX_BIN_PATH, certificatePath);
                }
            }
            await (0, shared_1.closeFirefox)();
            await (0, shared_1.addCertificateToNSSCertDB)(this.FIREFOX_NSS_DIR, certificatePath, getCertUtilPath());
        }
        else {
            debug('Firefox does not appear to be installed, skipping Firefox-specific steps...');
        }
    }
    removeFromTrustStores(certificatePath) {
        debug('Removing devcert root CA from macOS system keychain');
        try {
            (0, utils_1.run)('sudo', [
                'security',
                'remove-trusted-cert',
                '-d',
                certificatePath
            ], {
                stdio: 'ignore'
            });
        }
        catch (e) {
            debug(`failed to remove ${certificatePath} from macOS cert store, continuing. ${e.toString()}`);
        }
        if (this.isFirefoxInstalled() && this.isNSSInstalled()) {
            debug('Firefox install and certutil install detected. Trying to remove root CA from Firefox NSS databases');
            (0, shared_1.removeCertificateFromNSSCertDB)(this.FIREFOX_NSS_DIR, certificatePath, getCertUtilPath());
        }
    }
    async addDomainToHostFileIfMissing(domain) {
        const trimDomain = domain.trim().replace(/[\s;]/g, '');
        let hostsFileContents = (0, fs_1.readFileSync)(this.HOST_FILE_PATH, 'utf8');
        if (!hostsFileContents.includes(trimDomain)) {
            (0, utils_1.sudoAppend)(this.HOST_FILE_PATH, `127.0.0.1 ${trimDomain}\n`);
        }
    }
    deleteProtectedFiles(filepath) {
        (0, shared_1.assertNotTouchingFiles)(filepath, 'delete');
        (0, utils_1.run)('sudo', ['rm', '-rf', filepath]);
    }
    async readProtectedFile(filepath) {
        (0, shared_1.assertNotTouchingFiles)(filepath, 'read');
        return (await (0, utils_1.run)('sudo', ['cat', filepath])).toString().trim();
    }
    async writeProtectedFile(filepath, contents) {
        (0, shared_1.assertNotTouchingFiles)(filepath, 'write');
        if ((0, fs_1.existsSync)(filepath)) {
            await (0, utils_1.run)('sudo', ['rm', filepath]);
        }
        (0, fs_1.writeFileSync)(filepath, contents);
        await (0, utils_1.run)('sudo', ['chown', '0', filepath]);
        await (0, utils_1.run)('sudo', ['chmod', '600', filepath]);
    }
    isFirefoxInstalled() {
        return (0, fs_1.existsSync)(this.FIREFOX_BUNDLE_PATH);
    }
    isNSSInstalled() {
        try {
            return (0, utils_1.run)('brew', ['list', '-1']).toString().includes('\nnss\n');
        }
        catch (e) {
            return false;
        }
    }
}
exports.default = MacOSPlatform;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGFyd2luLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwbGF0Zm9ybXMvZGFyd2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsZ0RBQXdCO0FBQ3hCLDJCQUE0RjtBQUM1RixrREFBZ0M7QUFDaEMsb0NBQTBEO0FBRTFELHFDQUFxSjtBQUdySixNQUFNLEtBQUssR0FBRyxJQUFBLGVBQVcsRUFBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBRXJELE1BQU0sZUFBZSxHQUFHLEdBQUcsRUFBRSxDQUFDLGNBQUksQ0FBQyxJQUFJLENBQUMsSUFBQSxXQUFHLEVBQUMsTUFBTSxFQUFFLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBRS9HLE1BQXFCLGFBQWE7SUFBbEM7UUFFVSx3QkFBbUIsR0FBRywyQkFBMkIsQ0FBQztRQUNsRCxxQkFBZ0IsR0FBRyxjQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1FBQ2pGLG9CQUFlLEdBQUcsY0FBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxnREFBZ0QsQ0FBQyxDQUFDO1FBRWhHLG1CQUFjLEdBQUcsWUFBWSxDQUFDO0lBb0h4QyxDQUFDO0lBbEhDOzs7Ozs7T0FNRztJQUNILEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxlQUF1QixFQUFFLFVBQW1CLEVBQUU7UUFFbkUsK0JBQStCO1FBQy9CLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO1FBQ3pELElBQUEsV0FBRyxFQUFDLE1BQU0sRUFBRTtZQUNWLFVBQVU7WUFDVixrQkFBa0I7WUFDbEIsSUFBSTtZQUNKLElBQUk7WUFDSixXQUFXO1lBQ1gsSUFBSTtZQUNKLG9DQUFvQztZQUNwQyxJQUFJO1lBQ0osS0FBSztZQUNMLElBQUk7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QUksQ0FBQztZQUNILE9BQU8sSUFBQSxXQUFHLEVBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ1gsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQztDQUVGO0FBMUhELGdDQTBIQztBQUFBLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHdyaXRlRmlsZVN5bmMgYXMgd3JpdGVGaWxlLCBleGlzdHNTeW5jIGFzIGV4aXN0cywgcmVhZEZpbGVTeW5jIGFzIHJlYWQgfSBmcm9tICdmcyc7XG5pbXBvcnQgY3JlYXRlRGVidWcgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgcnVuLCBzdWRvQXBwZW5kLCBjb21tYW5kRXhpc3RzIH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHsgT3B0aW9ucyB9IGZyb20gJy4uL2luZGV4JztcbmltcG9ydCB7IGFkZENlcnRpZmljYXRlVG9OU1NDZXJ0REIsIGFzc2VydE5vdFRvdWNoaW5nRmlsZXMsIG9wZW5DZXJ0aWZpY2F0ZUluRmlyZWZveCwgY2xvc2VGaXJlZm94LCByZW1vdmVDZXJ0aWZpY2F0ZUZyb21OU1NDZXJ0REIgfSBmcm9tICcuL3NoYXJlZCc7XG5pbXBvcnQgeyBQbGF0Zm9ybSB9IGZyb20gJy4nO1xuXG5jb25zdCBkZWJ1ZyA9IGNyZWF0ZURlYnVnKCdkZXZjZXJ0OnBsYXRmb3JtczptYWNvcycpO1xuXG5jb25zdCBnZXRDZXJ0VXRpbFBhdGggPSAoKSA9PiBwYXRoLmpvaW4ocnVuKCdicmV3JywgWyctLXByZWZpeCcsICduc3MnXSkudG9TdHJpbmcoKS50cmltKCksICdiaW4nLCAnY2VydHV0aWwnKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWFjT1NQbGF0Zm9ybSBpbXBsZW1lbnRzIFBsYXRmb3JtIHtcblxuICBwcml2YXRlIEZJUkVGT1hfQlVORExFX1BBVEggPSAnL0FwcGxpY2F0aW9ucy9GaXJlZm94LmFwcCc7XG4gIHByaXZhdGUgRklSRUZPWF9CSU5fUEFUSCA9IHBhdGguam9pbih0aGlzLkZJUkVGT1hfQlVORExFX1BBVEgsICdDb250ZW50cy9NYWNPUy9maXJlZm94Jyk7XG4gIHByaXZhdGUgRklSRUZPWF9OU1NfRElSID0gcGF0aC5qb2luKHByb2Nlc3MuZW52LkhPTUUsICdMaWJyYXJ5L0FwcGxpY2F0aW9uIFN1cHBvcnQvRmlyZWZveC9Qcm9maWxlcy8qJyk7XG5cbiAgcHJpdmF0ZSBIT1NUX0ZJTEVfUEFUSCA9ICcvZXRjL2hvc3RzJztcblxuICAvKipcbiAgICogbWFjT1MgaXMgcHJldHR5IHNpbXBsZSAtIGp1c3QgYWRkIHRoZSBjZXJ0aWZpY2F0ZSB0byB0aGUgc3lzdGVtIGtleWNoYWluLFxuICAgKiBhbmQgbW9zdCBhcHBsaWNhdGlvbnMgd2lsbCBkZWxlZ2F0ZSB0byB0aGF0IGZvciBkZXRlcm1pbmluZyB0cnVzdGVkXG4gICAqIGNlcnRpZmljYXRlcy4gRmlyZWZveCwgb2YgY291cnNlLCBkb2VzIGl0J3Mgb3duIHRoaW5nLiBXZSBjYW4gdHJ5IHRvXG4gICAqIGF1dG9tYXRpY2FsbHkgaW5zdGFsbCB0aGUgY2VydCB3aXRoIEZpcmVmb3ggaWYgd2UgY2FuIHVzZSBjZXJ0dXRpbCB2aWEgdGhlXG4gICAqIGBuc3NgIEhvbWVicmV3IHBhY2thZ2UsIG90aGVyd2lzZSB3ZSBnbyBtYW51YWwgd2l0aCB1c2VyLWZhY2luZyBwcm9tcHRzLlxuICAgKi9cbiAgYXN5bmMgYWRkVG9UcnVzdFN0b3JlcyhjZXJ0aWZpY2F0ZVBhdGg6IHN0cmluZywgb3B0aW9uczogT3B0aW9ucyA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG5cbiAgICAvLyBDaHJvbWUsIFNhZmFyaSwgc3lzdGVtIHV0aWxzXG4gICAgZGVidWcoJ0FkZGluZyBkZXZjZXJ0IHJvb3QgQ0EgdG8gbWFjT1Mgc3lzdGVtIGtleWNoYWluJyk7XG4gICAgcnVuKCdzdWRvJywgW1xuICAgICAgJ3NlY3VyaXR5JyxcbiAgICAgICdhZGQtdHJ1c3RlZC1jZXJ0JyxcbiAgICAgICctZCcsXG4gICAgICAnLXInLFxuICAgICAgJ3RydXN0Um9vdCcsXG4gICAgICAnLWsnLFxuICAgICAgJy9MaWJyYXJ5L0tleWNoYWlucy9TeXN0ZW0ua2V5Y2hhaW4nLFxuICAgICAgJy1wJyxcbiAgICAgICdzc2wnLFxuICAgICAgJy1wJyxcbiAgICAgICdiYXNpYycsXG4gICAgICBjZXJ0aWZpY2F0ZVBhdGhcbiAgICBdKTtcblxuICAgIGlmICh0aGlzLmlzRmlyZWZveEluc3RhbGxlZCgpKSB7XG4gICAgICAvLyBUcnkgdG8gdXNlIGNlcnR1dGlsIHRvIGluc3RhbGwgdGhlIGNlcnQgYXV0b21hdGljYWxseVxuICAgICAgZGVidWcoJ0ZpcmVmb3ggaW5zdGFsbCBkZXRlY3RlZC4gQWRkaW5nIGRldmNlcnQgcm9vdCBDQSB0byBGaXJlZm94IHRydXN0IHN0b3JlJyk7XG4gICAgICBpZiAoIXRoaXMuaXNOU1NJbnN0YWxsZWQoKSkge1xuICAgICAgICBpZiAoIW9wdGlvbnMuc2tpcENlcnR1dGlsSW5zdGFsbCkge1xuICAgICAgICAgIGlmIChjb21tYW5kRXhpc3RzKCdicmV3JykpIHtcbiAgICAgICAgICAgIGRlYnVnKGBjZXJ0dXRpbCBpcyBub3QgYWxyZWFkeSBpbnN0YWxsZWQsIGJ1dCBIb21lYnJldyBpcyBkZXRlY3RlZC4gVHJ5aW5nIHRvIGluc3RhbGwgY2VydHV0aWwgdmlhIEhvbWVicmV3Li4uYCk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBydW4oJ2JyZXcnLCBbJ2luc3RhbGwnLCAnbnNzJ10sIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICBkZWJ1ZyhgYnJldyBpbnN0YWxsIG5zcyBmYWlsZWRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVidWcoYEhvbWVicmV3IGRpZG4ndCB3b3JrLCBzbyB3ZSBjYW4ndCB0cnkgdG8gaW5zdGFsbCBjZXJ0dXRpbC4gRmFsbGluZyBiYWNrIHRvIG1hbnVhbCBjZXJ0aWZpY2F0ZSBpbnN0YWxsYCk7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgb3BlbkNlcnRpZmljYXRlSW5GaXJlZm94KHRoaXMuRklSRUZPWF9CSU5fUEFUSCwgY2VydGlmaWNhdGVQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVidWcoYGNlcnR1dGlsIGlzIG5vdCBhbHJlYWR5IGluc3RhbGxlZCwgYW5kIHNraXBDZXJ0dXRpbEluc3RhbGwgaXMgdHJ1ZSwgc28gd2UgaGF2ZSB0byBmYWxsIGJhY2sgdG8gYSBtYW51YWwgaW5zdGFsbGApXG4gICAgICAgICAgcmV0dXJuIGF3YWl0IG9wZW5DZXJ0aWZpY2F0ZUluRmlyZWZveCh0aGlzLkZJUkVGT1hfQklOX1BBVEgsIGNlcnRpZmljYXRlUGF0aCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGF3YWl0IGNsb3NlRmlyZWZveCgpO1xuICAgICAgYXdhaXQgYWRkQ2VydGlmaWNhdGVUb05TU0NlcnREQih0aGlzLkZJUkVGT1hfTlNTX0RJUiwgY2VydGlmaWNhdGVQYXRoLCBnZXRDZXJ0VXRpbFBhdGgoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlYnVnKCdGaXJlZm94IGRvZXMgbm90IGFwcGVhciB0byBiZSBpbnN0YWxsZWQsIHNraXBwaW5nIEZpcmVmb3gtc3BlY2lmaWMgc3RlcHMuLi4nKTtcbiAgICB9XG4gIH1cbiAgXG4gIHJlbW92ZUZyb21UcnVzdFN0b3JlcyhjZXJ0aWZpY2F0ZVBhdGg6IHN0cmluZykge1xuICAgIGRlYnVnKCdSZW1vdmluZyBkZXZjZXJ0IHJvb3QgQ0EgZnJvbSBtYWNPUyBzeXN0ZW0ga2V5Y2hhaW4nKTtcbiAgICB0cnkge1xuICAgICAgcnVuKCdzdWRvJywgW1xuICAgICAgICAnc2VjdXJpdHknLFxuICAgICAgICAncmVtb3ZlLXRydXN0ZWQtY2VydCcsXG4gICAgICAgICctZCcsXG4gICAgICAgIGNlcnRpZmljYXRlUGF0aFxuICAgICAgXSwge1xuICAgICAgICBzdGRpbzogJ2lnbm9yZSdcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgZGVidWcoYGZhaWxlZCB0byByZW1vdmUgJHsgY2VydGlmaWNhdGVQYXRoIH0gZnJvbSBtYWNPUyBjZXJ0IHN0b3JlLCBjb250aW51aW5nLiAkeyBlLnRvU3RyaW5nKCkgfWApO1xuICAgIH1cbiAgICBpZiAodGhpcy5pc0ZpcmVmb3hJbnN0YWxsZWQoKSAmJiB0aGlzLmlzTlNTSW5zdGFsbGVkKCkpIHtcbiAgICAgIGRlYnVnKCdGaXJlZm94IGluc3RhbGwgYW5kIGNlcnR1dGlsIGluc3RhbGwgZGV0ZWN0ZWQuIFRyeWluZyB0byByZW1vdmUgcm9vdCBDQSBmcm9tIEZpcmVmb3ggTlNTIGRhdGFiYXNlcycpO1xuICAgICAgcmVtb3ZlQ2VydGlmaWNhdGVGcm9tTlNTQ2VydERCKHRoaXMuRklSRUZPWF9OU1NfRElSLCBjZXJ0aWZpY2F0ZVBhdGgsIGdldENlcnRVdGlsUGF0aCgpKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBhZGREb21haW5Ub0hvc3RGaWxlSWZNaXNzaW5nKGRvbWFpbjogc3RyaW5nKSB7XG4gICAgY29uc3QgdHJpbURvbWFpbiA9IGRvbWFpbi50cmltKCkucmVwbGFjZSgvW1xccztdL2csJycpXG4gICAgbGV0IGhvc3RzRmlsZUNvbnRlbnRzID0gcmVhZCh0aGlzLkhPU1RfRklMRV9QQVRILCAndXRmOCcpO1xuICAgIGlmICghaG9zdHNGaWxlQ29udGVudHMuaW5jbHVkZXModHJpbURvbWFpbikpIHtcbiAgICAgIHN1ZG9BcHBlbmQodGhpcy5IT1NUX0ZJTEVfUEFUSCwgYDEyNy4wLjAuMSAke3RyaW1Eb21haW59XFxuYCk7XG4gICAgfVxuICB9XG5cbiAgZGVsZXRlUHJvdGVjdGVkRmlsZXMoZmlsZXBhdGg6IHN0cmluZykge1xuICAgIGFzc2VydE5vdFRvdWNoaW5nRmlsZXMoZmlsZXBhdGgsICdkZWxldGUnKTtcbiAgICBydW4oJ3N1ZG8nLCBbJ3JtJywgJy1yZicsIGZpbGVwYXRoXSk7XG4gIH1cblxuICBhc3luYyByZWFkUHJvdGVjdGVkRmlsZShmaWxlcGF0aDogc3RyaW5nKSB7XG4gICAgYXNzZXJ0Tm90VG91Y2hpbmdGaWxlcyhmaWxlcGF0aCwgJ3JlYWQnKTtcbiAgICByZXR1cm4gKGF3YWl0IHJ1bignc3VkbycsIFsnY2F0JywgZmlsZXBhdGhdKSkudG9TdHJpbmcoKS50cmltKCk7XG4gIH1cblxuICBhc3luYyB3cml0ZVByb3RlY3RlZEZpbGUoZmlsZXBhdGg6IHN0cmluZywgY29udGVudHM6IHN0cmluZykge1xuICAgIGFzc2VydE5vdFRvdWNoaW5nRmlsZXMoZmlsZXBhdGgsICd3cml0ZScpO1xuICAgIGlmIChleGlzdHMoZmlsZXBhdGgpKSB7XG4gICAgICBhd2FpdCBydW4oJ3N1ZG8nLCBbJ3JtJywgZmlsZXBhdGhdKTtcbiAgICB9XG4gICAgd3JpdGVGaWxlKGZpbGVwYXRoLCBjb250ZW50cyk7XG4gICAgYXdhaXQgcnVuKCdzdWRvJywgWydjaG93bicsICcwJywgZmlsZXBhdGhdKTtcbiAgICBhd2FpdCBydW4oJ3N1ZG8nLCBbJ2NobW9kJywgJzYwMCcsIGZpbGVwYXRoXSk7XG4gIH1cblxuICBwcml2YXRlIGlzRmlyZWZveEluc3RhbGxlZCgpIHtcbiAgICByZXR1cm4gZXhpc3RzKHRoaXMuRklSRUZPWF9CVU5ETEVfUEFUSCk7XG4gIH1cblxuICBwcml2YXRlIGlzTlNTSW5zdGFsbGVkKCkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gcnVuKCdicmV3JywgWydsaXN0JywgJy0xJ10pLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ1xcbm5zc1xcbicpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxufTtcbiJdfQ==