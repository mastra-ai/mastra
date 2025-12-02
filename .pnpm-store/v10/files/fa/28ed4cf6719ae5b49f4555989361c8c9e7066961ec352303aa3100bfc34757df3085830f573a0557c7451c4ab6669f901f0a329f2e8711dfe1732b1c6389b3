export type Hex = `0x${string}`;
export type Address = Hex;
export type EIP1193EventMap = {
    accountsChanged(accounts: Address[]): void;
    chainChanged(chainId: string): void;
    connect(connectInfo: {
        chainId: string;
    }): void;
    disconnect(error: {
        code: number;
        message: string;
    }): void;
    message(message: {
        type: string;
        data: unknown;
    }): void;
};
export type EIP1193Events = {
    on<event extends keyof EIP1193EventMap>(event: event, listener: EIP1193EventMap[event]): void;
    removeListener<event extends keyof EIP1193EventMap>(event: event, listener: EIP1193EventMap[event]): void;
};
export type EIP1193RequestFn = (args: {
    method: string;
    params?: unknown;
}) => Promise<unknown>;
export type EIP1193Provider = EIP1193Events & {
    address: string;
    request: EIP1193RequestFn;
};
export type EthereumWallet = EIP1193Provider;
/**
 * EIP-4361 message fields
 */
export type SiweMessage = {
    /**
     * The Ethereum address performing the signing.
     */
    address: Address;
    /**
     * The [EIP-155](https://eips.ethereum.org/EIPS/eip-155) Chain ID to which the session is bound,
     */
    chainId: number;
    /**
     * [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) authority that is requesting the signing.
     */
    domain: string;
    /**
     * Time when the signed authentication message is no longer valid.
     */
    expirationTime?: Date | undefined;
    /**
     * Time when the message was generated, typically the current time.
     */
    issuedAt?: Date | undefined;
    /**
     * A random string typically chosen by the relying party and used to prevent replay attacks.
     */
    nonce?: string;
    /**
     * Time when the signed authentication message will become valid.
     */
    notBefore?: Date | undefined;
    /**
     * A system-specific identifier that may be used to uniquely refer to the sign-in request.
     */
    requestId?: string | undefined;
    /**
     * A list of information or references to information the user wishes to have resolved as part of authentication by the relying party.
     */
    resources?: string[] | undefined;
    /**
     * [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986#section-3.1) URI scheme of the origin of the request.
     */
    scheme?: string | undefined;
    /**
     * A human-readable ASCII assertion that the user will sign.
     */
    statement?: string | undefined;
    /**
     * [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) URI referring to the resource that is the subject of the signing (as in the subject of a claim).
     */
    uri: string;
    /**
     * The current version of the SIWE Message.
     */
    version: '1';
};
export type EthereumSignInInput = SiweMessage;
export declare function getAddress(address: string): Address;
export declare function fromHex(hex: Hex): number;
export declare function toHex(value: string): Hex;
/**
 * Creates EIP-4361 formatted message.
 */
export declare function createSiweMessage(parameters: SiweMessage): string;
//# sourceMappingURL=ethereum.d.ts.map