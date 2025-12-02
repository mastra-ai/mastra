declare class ClerkUrl extends URL {
    isCrossOrigin(other: URL | string): boolean;
}
export type WithClerkUrl<T> = T & {
    /**
     * When a NextJs app is hosted on a platform different from Vercel
     * or inside a container (Netlify, Fly.io, AWS Amplify, docker etc),
     * req.url is always set to `localhost:3000` instead of the actual host of the app.
     *
     * The `authMiddleware` uses the value of the available req.headers in order to construct
     * and use the correct url internally. This url is then exposed as `experimental_clerkUrl`,
     * intended to be used within `beforeAuth` and `afterAuth` if needed.
     */
    clerkUrl: ClerkUrl;
};
export declare const createClerkUrl: (...args: ConstructorParameters<typeof ClerkUrl>) => ClerkUrl;
export type { ClerkUrl };
//# sourceMappingURL=clerkUrl.d.ts.map