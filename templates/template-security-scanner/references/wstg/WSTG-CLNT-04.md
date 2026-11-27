# Testing for Client-side URL Redirect

|ID          |
|------------|
|WSTG-CLNT-04|

## Summary

This section describes how to check for client-side URL redirection, also known as open redirection. It is an input validation flaw that exists when an application accepts user-controlled input that specifies a link which leads to an external URL that could be malicious. This kind of vulnerability could be used to accomplish a phishing attack or redirect a victim to an infection page.

This vulnerability occurs when an application accepts untrusted input that contains a URL value and does not sanitize it. This URL value could cause the web application to redirect the user to another page, such as a malicious page controlled by the attacker.

This vulnerability may enable an attacker to successfully launch a phishing scam and steal user credentials. Since the redirection is originated by the real application, the phishing attempts may have a more trustworthy appearance.

Here is an example of a phishing attack URL.

```text
http://www.target.site?#redirect=www.fake-target.site
```

The victim that visits this URL will be automatically redirected to `fake-target.site`, where an attacker could place a fake page that resembles the intended site, in order to steal the victim's credentials.

Open redirection could also be used to craft a URL that would bypass the application’s access control checks and forward the attacker to privileged functions that they would normally not be able to access.

## Test Objectives

- Identify injection points that handle URLs or paths.
- Assess the locations that the system could redirect to.

## How to Test

When testers manually check for this type of vulnerability, they first identify if there are client-side redirections implemented in the client-side code. These redirections may be implemented, to give a JavaScript example, using the `window.location` object. This can be used to direct the browser to another page by simply assigning a string to it. This is demonstrated in the following snippet:

```js
var redir = location.hash.substring(1);
if (redir) {
    window.location='http://'+decodeURIComponent(redir);
}
```

In this example, the script does not perform any validation of the variable `redir` which contains the user-supplied input via the query string. Since no form of encoding is applied, this unvalidated input is passed to the `windows.location` object, creating a URL redirection vulnerability.

This implies that an attacker could redirect the victim to a malicious site simply by submitting the following query string:

```text
http://www.victim.site/?#www.malicious.site
```

With a slight modification, the above example snippet can be vulnerable to JavaScript injection.

```js
var redir = location.hash.substring(1);
if (redir) {
    window.location=decodeURIComponent(redir);
}
```

This can be exploited by submitting the following query string:

```text
http://www.victim.site/?#javascript:alert(document.cookie)
```

When testing for this vulnerability, consider that some characters are treated differently by different browsers. For reference, see [DOM-based XSS](https://owasp.org/www-community/attacks/DOM_Based_XSS).
