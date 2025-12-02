declare const createOTP: (secret: string, opts?: {
    digits?: number;
    period?: number;
}) => {
    hotp: (counter: number) => Promise<string>;
    totp: () => Promise<string>;
    verify: (otp: string, options?: {
        window?: number;
    }) => Promise<boolean>;
    url: (issuer: string, account: string) => string;
};

export { createOTP };
