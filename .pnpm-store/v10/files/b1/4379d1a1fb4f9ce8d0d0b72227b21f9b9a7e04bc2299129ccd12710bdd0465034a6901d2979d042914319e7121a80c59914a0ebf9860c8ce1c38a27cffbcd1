import type { JWTPayload } from '../types';
/** Generic class for JWT producing. */
export declare class ProduceJWT {
    protected _payload: JWTPayload;
    /** @param payload The JWT Claims Set object. Defaults to an empty object. */
    constructor(payload?: JWTPayload);
    /**
     * Set the "iss" (Issuer) Claim.
     *
     * @param issuer "Issuer" Claim value to set on the JWT Claims Set.
     */
    setIssuer(issuer: string): this;
    /**
     * Set the "sub" (Subject) Claim.
     *
     * @param subject "sub" (Subject) Claim value to set on the JWT Claims Set.
     */
    setSubject(subject: string): this;
    /**
     * Set the "aud" (Audience) Claim.
     *
     * @param audience "aud" (Audience) Claim value to set on the JWT Claims Set.
     */
    setAudience(audience: string | string[]): this;
    /**
     * Set the "jti" (JWT ID) Claim.
     *
     * @param jwtId "jti" (JWT ID) Claim value to set on the JWT Claims Set.
     */
    setJti(jwtId: string): this;
    /**
     * Set the "nbf" (Not Before) Claim.
     *
     * - If a `number` is passed as an argument it is used as the claim directly.
     * - If a `Date` instance is passed as an argument it is converted to unix timestamp and used as the
     *   claim.
     * - If a `string` is passed as an argument it is resolved to a time span, and then added to the
     *   current unix timestamp and used as the claim.
     *
     * Format used for time span should be a number followed by a unit, such as "5 minutes" or "1
     * day".
     *
     * Valid units are: "sec", "secs", "second", "seconds", "s", "minute", "minutes", "min", "mins",
     * "m", "hour", "hours", "hr", "hrs", "h", "day", "days", "d", "week", "weeks", "w", "year",
     * "years", "yr", "yrs", and "y". It is not possible to specify months. 365.25 days is used as an
     * alias for a year.
     *
     * If the string is suffixed with "ago", or prefixed with a "-", the resulting time span gets
     * subtracted from the current unix timestamp. A "from now" suffix can also be used for
     * readability when adding to the current unix timestamp.
     *
     * @param input "nbf" (Not Before) Claim value to set on the JWT Claims Set.
     */
    setNotBefore(input: number | string | Date): this;
    /**
     * Set the "exp" (Expiration Time) Claim.
     *
     * - If a `number` is passed as an argument it is used as the claim directly.
     * - If a `Date` instance is passed as an argument it is converted to unix timestamp and used as the
     *   claim.
     * - If a `string` is passed as an argument it is resolved to a time span, and then added to the
     *   current unix timestamp and used as the claim.
     *
     * Format used for time span should be a number followed by a unit, such as "5 minutes" or "1
     * day".
     *
     * Valid units are: "sec", "secs", "second", "seconds", "s", "minute", "minutes", "min", "mins",
     * "m", "hour", "hours", "hr", "hrs", "h", "day", "days", "d", "week", "weeks", "w", "year",
     * "years", "yr", "yrs", and "y". It is not possible to specify months. 365.25 days is used as an
     * alias for a year.
     *
     * If the string is suffixed with "ago", or prefixed with a "-", the resulting time span gets
     * subtracted from the current unix timestamp. A "from now" suffix can also be used for
     * readability when adding to the current unix timestamp.
     *
     * @param input "exp" (Expiration Time) Claim value to set on the JWT Claims Set.
     */
    setExpirationTime(input: number | string | Date): this;
    /**
     * Set the "iat" (Issued At) Claim.
     *
     * - If no argument is used the current unix timestamp is used as the claim.
     * - If a `number` is passed as an argument it is used as the claim directly.
     * - If a `Date` instance is passed as an argument it is converted to unix timestamp and used as the
     *   claim.
     * - If a `string` is passed as an argument it is resolved to a time span, and then added to the
     *   current unix timestamp and used as the claim.
     *
     * Format used for time span should be a number followed by a unit, such as "5 minutes" or "1
     * day".
     *
     * Valid units are: "sec", "secs", "second", "seconds", "s", "minute", "minutes", "min", "mins",
     * "m", "hour", "hours", "hr", "hrs", "h", "day", "days", "d", "week", "weeks", "w", "year",
     * "years", "yr", "yrs", and "y". It is not possible to specify months. 365.25 days is used as an
     * alias for a year.
     *
     * If the string is suffixed with "ago", or prefixed with a "-", the resulting time span gets
     * subtracted from the current unix timestamp. A "from now" suffix can also be used for
     * readability when adding to the current unix timestamp.
     *
     * @param input "iat" (Expiration Time) Claim value to set on the JWT Claims Set.
     */
    setIssuedAt(input?: number | string | Date): this;
}
