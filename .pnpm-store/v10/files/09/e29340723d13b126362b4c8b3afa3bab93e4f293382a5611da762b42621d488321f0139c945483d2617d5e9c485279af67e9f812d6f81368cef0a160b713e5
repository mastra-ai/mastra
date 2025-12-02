// types and functions copied over from viem so this library doesn't depend on it
export function getAddress(address) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(`@supabase/auth-js: Address "${address}" is invalid.`);
    }
    return address.toLowerCase();
}
export function fromHex(hex) {
    return parseInt(hex, 16);
}
export function toHex(value) {
    const bytes = new TextEncoder().encode(value);
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return ('0x' + hex);
}
/**
 * Creates EIP-4361 formatted message.
 */
export function createSiweMessage(parameters) {
    var _a;
    const { chainId, domain, expirationTime, issuedAt = new Date(), nonce, notBefore, requestId, resources, scheme, uri, version, } = parameters;
    // Validate fields
    {
        if (!Number.isInteger(chainId))
            throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${chainId}`);
        if (!domain)
            throw new Error(`@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`);
        if (nonce && nonce.length < 8)
            throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${nonce}`);
        if (!uri)
            throw new Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`);
        if (version !== '1')
            throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${version}`);
        if ((_a = parameters.statement) === null || _a === void 0 ? void 0 : _a.includes('\n'))
            throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${parameters.statement}`);
    }
    // Construct message
    const address = getAddress(parameters.address);
    const origin = scheme ? `${scheme}://${domain}` : domain;
    const statement = parameters.statement ? `${parameters.statement}\n` : '';
    const prefix = `${origin} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}`;
    let suffix = `URI: ${uri}\nVersion: ${version}\nChain ID: ${chainId}${nonce ? `\nNonce: ${nonce}` : ''}\nIssued At: ${issuedAt.toISOString()}`;
    if (expirationTime)
        suffix += `\nExpiration Time: ${expirationTime.toISOString()}`;
    if (notBefore)
        suffix += `\nNot Before: ${notBefore.toISOString()}`;
    if (requestId)
        suffix += `\nRequest ID: ${requestId}`;
    if (resources) {
        let content = '\nResources:';
        for (const resource of resources) {
            if (!resource || typeof resource !== 'string')
                throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${resource}`);
            content += `\n- ${resource}`;
        }
        suffix += content;
    }
    return `${prefix}\n${suffix}`;
}
//# sourceMappingURL=ethereum.js.map