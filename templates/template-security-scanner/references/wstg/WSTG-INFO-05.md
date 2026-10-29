# Review Webpage Content for Information Leakage

|ID          |
|------------|
|WSTG-INFO-05|

## Summary

It is very common, and even recommended, for programmers to include detailed comments and metadata on their source code. However, comments and metadata included into the HTML code might reveal internal information that should not be available to potential attackers. Comments and metadata review should be done in order to determine if any information is being leaked.

For modern web apps, the use of client-Side JavaScript for the front-end is becoming more popular. Popular front-end construction technologies use client-side JavaScript like ReactJS, AngularJS, or Vue.  Similar to the comments and metadata in HTML code, many programmers also hardcod sensitive information in JavaScript variables on the front-end. Sensitive information can include (but is not limited to): Private API Keys (*e.g.* an unrestricted Google Map API Key), internal IP addresses, sensitive routes (*e.g.* route to hidden admin pages or functionality), or even credentials. This sensitive information can be leaked from such front-end JavaScript code. A review should be done in order to determine if any sensitive information leaked which could be used by attackers for abuse.

For large web applications, performance issues are a big concern to programmers. Programmers have used different methods to optimize front-end performance, including Syntactically Awesome Style Sheets (SASS), Sassy CSS (SCSS), webpack, etc. Using these technologies, front-end code will sometimes become harder to understand and difficult to debug, and because of it, programmers often deploy source map files for debugging purposes. A "source map" is a special file that connects a minified/uglified version of an asset (CSS or JavaScript) to the original authored version. Programmers are still debating whether or not to bring source map files to the production environment. However, it is undeniable that source map files or files for debugging if released to the production environment will make their source more human-readable. It can make it easier for attackers to find vulnerabilities from the front-end or collect sensitive information from it. JavaScript code review should be done in order to determine if any debug files are exposed from the front-end. Depending on the context and sensitivity of the project, a security expert should decide whether the files should exist in the production environment or not.

## Test Objectives

- Review webpage comments and metadata to find any information leakage.
- Gather JavaScript files and review the JS code to better understand the application and to find any information leakage.
- Identify if source map files or other front-end debug files exist.

## How to Test

### Review webpage comments and metadata

HTML comments are often used by the developers to include debugging information about the application. Sometimes, they forget about the comments and they leave them in production environments. Testers should look for HTML comments which start with `<!--`.

Check HTML source code for comments containing sensitive information that can help the attacker gain more insight about the application. It might be SQL code, usernames and passwords, internal IP addresses, or debugging information.

```html
...
<div class="table2">
  <div class="col1">1</div><div class="col2">Mary</div>
  <div class="col1">2</div><div class="col2">Peter</div>
  <div class="col1">3</div><div class="col2">Joe</div>

<!-- Query: SELECT id, name FROM app.users WHERE active='1' -->

</div>
...
```

The tester may even find something like this:

```html
<!-- Use the DB administrator password for testing:  f@keP@a$$w0rD -->
```

Check HTML version information for valid version numbers and Data Type Definition (DTD) URLs

```html
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
```

- `strict.dtd` -- default strict DTD
- `loose.dtd` -- loose DTD
- `frameset.dtd` -- DTD for frameset documents

Some `META` tags do not provide active attack vectors but instead allow an attacker to profile an application:

```html
<META name="Author" content="Andrew Muller">
```

A common (but not [WCAG](https://www.w3.org/WAI/standards-guidelines/wcag/) compliant) `META` tag is [Refresh](https://en.wikipedia.org/wiki/Meta_refresh).

```html
<META http-equiv="Refresh" content="15;URL=https://www.owasp.org/index.html">
```

A common use for `META` tag is to specify keywords that a search engine may use to improve the quality of search results.

```html
<META name="keywords" lang="en-us" content="OWASP, security, sunshine, lollipops">
```

Although most web servers manage search engine indexing via the `robots.txt` file, it can also be managed by `META` tags. The tag below will advise robots to not index and not follow links on the HTML page containing the tag.

```html
<META name="robots" content="none">
```

The [Platform for Internet Content Selection (PICS)](https://www.w3.org/PICS/) and [Protocol for Web Description Resources (POWDER)](https://www.w3.org/2007/powder/) provide infrastructure for associating metadata with Internet content.

### Identifying JavaScript Code and Gathering JavaScript Files

Programmers often hardcode sensitive information with JavaScript variables on the front-end. Testers should check HTML source code and look for JavaScript code between `<script>` and `</script>` tags. Testers should also identify external JavaScript files to review the code (JavaScript files have the file extension `.js` and name of the JavaScript file usually put in the `src` (source) attribute of a `<script>` tag).

Check JavaScript code for any sensitive information leaks which could be used by attackers to further abuse or manipulate the system. Look for values such as: API keys, internal IP addresses, sensitive routes, or credentials. For example:

```javascript
const myS3Credentials = {
  accessKeyId: config('AWSS3AccessKeyID'),
  secretAcccessKey: config('AWSS3SecretAccessKey'),
};
```

The tester may even find something like this:

```javascript
var conString = "tcp://postgres:1234@localhost/postgres";
```

When an API Key is found, testers can check if the API Key restrictions are set per service or by IP, HTTP referrer, application, SDK, etc.

For example, if testers found a Google Map API Key, they can check if this API Key is restricted by IP or restricted only per the Google Map APIs. If the Google API Key is restricted only per the Google Map APIs, attackers can still use that API Key to query unrestricted Google Map APIs and the application owner must to pay for that.

```html

<script type="application/json">
...
{"GOOGLE_MAP_API_KEY":"AIzaSyDUEBnKgwiqMNpDplT6ozE4Z0XxuAbqDi4", "RECAPTCHA_KEY":"6LcPscEUiAAAAHOwwM3fGvIx9rsPYUq62uRhGjJ0"}
...
</script>
```

In some cases, testers may find sensitive routes from JavaScript code, such as links to internal or hidden admin pages.

```html
<script type="application/json">
...
"runtimeConfig":{"BASE_URL_VOUCHER_API":"https://staging-voucher.victim.net/api", "BASE_BACKOFFICE_API":"https://10.10.10.2/api", "ADMIN_PAGE":"/hidden_administrator"}
...
</script>
```

### Identifying Source Map Files

Source map files will usually be loaded when DevTools open. Testers can also find source map files by adding the ".map" extension after the extension of each external JavaScript file. For example, if a tester sees a `/static/js/main.chunk.js` file, they can then check for its source map file by visiting `/static/js/main.chunk.js.map`.

#### Black-Box Testing

Check source map files for any sensitive information that can help the attacker gain more insight about the application. For example:

```json
{
  "version": 3,
  "file": "static/js/main.chunk.js",
  "sources": [
    "/home/sysadmin/cashsystem/src/actions/index.js",
    "/home/sysadmin/cashsystem/src/actions/reportAction.js",
    "/home/sysadmin/cashsystem/src/actions/cashoutAction.js",
    "/home/sysadmin/cashsystem/src/actions/userAction.js",
    "..."
  ],
  "..."
}
```

When websites load source map files, the front-end source code will become readable and easier to debug.

## Tools

- [Wget](https://www.gnu.org/software/wget/wget.html)
- Browser "view source" function
- Eyeballs
- [Curl](https://curl.haxx.se/)
- [Burp Suite](https://portswigger.net/burp)
- [Waybackurls](https://github.com/tomnomnom/waybackurls)
- [Google Maps API Scanner](https://github.com/ozguralp/gmapsapiscanner/)

## References

- [KeyHacks](https://github.com/streaak/keyhacks)

### Whitepapers

- [HTML version 4.01](https://www.w3.org/TR/1999/REC-html401-19991224)
- [XHTML](https://www.w3.org/TR/2010/REC-xhtml-basic-20101123/)
- [HTML version 5](https://www.w3.org/TR/html5/)
