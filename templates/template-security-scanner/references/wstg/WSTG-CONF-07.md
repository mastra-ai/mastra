# Test HTTP Strict Transport Security

|ID          |
|------------|
|WSTG-CONF-07|

## Summary

The HTTP Strict Transport Security (HSTS) feature lets a web application inform the browser through the use of a special response header that it should never establish a connection to the specified domain servers using un-encrypted HTTP. Instead, it should automatically establish all connection requests to access the site through HTTPS. It also prevents users from overriding certificate errors.

Considering the importance of this security measure it is prudent to verify that the web site is using this HTTP header in order to ensure that all the data travels encrypted between the web browser and the server.

The HTTP strict transport security header uses two directives:

- `max-age`: to indicate the number of seconds that the browser should automatically convert all HTTP requests to HTTPS.
- `includeSubDomains`: to indicate that all related sub-domains must use HTTPS.
- `preload` Unofficial: to indicate that the domain(s) are on the preload list(s) and that browsers should never connect without HTTPS.
  - This is supported by all major browsers but is not official part of the specification. (See [hstspreload.org](https://hstspreload.org/) for more information.)

Here's an example of the HSTS header implementation:

`Strict-Transport-Security: max-age=31536000; includeSubDomains`

The use of this header by web applications must be checked to find if the following security issues could be produced:

- Attackers sniffing the network traffic and accessing the information transferred through an un-encrypted channel.
- Attackers exploiting a manipulator in the middle attack because of the problem of accepting certificates that are not trusted.
- Users who mistakenly entered an address in the browser putting HTTP instead of HTTPS, or users who click on a link in a web application which mistakenly indicated use of the HTTP protocol.

## Test Objectives

- Review the HSTS header and its validity.

## How to Test

The presence of the HSTS header can be confirmed by examining the server's response through an intercepting proxy or by using curl as follows:

```bash
$ curl -s -D- https://owasp.org | grep -i strict
Strict-Transport-Security: max-age=31536000
```

## References

- [OWASP HTTP Strict Transport Security](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html)
- [OWASP Appsec Tutorial Series - Episode 4: Strict Transport Security](https://www.youtube.com/watch?v=zEV3HOuM_Vw)
- [HSTS Specification](https://tools.ietf.org/html/rfc6797)
