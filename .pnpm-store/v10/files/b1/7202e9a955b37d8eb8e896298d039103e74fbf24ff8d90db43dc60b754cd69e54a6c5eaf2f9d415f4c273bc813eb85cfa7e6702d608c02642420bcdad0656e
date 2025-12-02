# iron-session [![GitHub license](https://img.shields.io/github/license/vvo/iron-session?style=flat)](https://github.com/vvo/iron-session/blob/master/LICENSE) [![Tests](https://github.com/vvo/iron-session/workflows/Tests/badge.svg)](https://github.com/vvo/iron-session/actions) [![npm](https://img.shields.io/npm/v/iron-session)](https://www.npmjs.com/package/iron-session) [![Downloads](https://img.shields.io/npm/dm/next-iron-session.svg)](http://npm-stat.com/charts.html?package=iron-session)

<p align="center"><b>⭐️ Featured in the <a href="https://nextjs.org/docs/authentication">Next.js documentation</a></b></p>

_🛠 Node.js stateless session utility using signed and encrypted cookies to store data. Works with Next.js, Express, and Node.js HTTP servers._

The session data is stored in encrypted cookies ("seals"). And only your server can decode the session data. There are no session ids, making iron sessions "stateless" from the server point of view.

This strategy of storing session data is the same technique used by **frameworks like [Ruby On Rails](https://guides.rubyonrails.org/security.html#session-storage)** (their default strategy).

The underlying cryptography library is [iron](https://hapi.dev/module/iron) which was [created by the lead developer of OAuth 2.0](https://hueniversedotcom.wordpress.com/2015/09/19/auth-to-see-the-wizard-or-i-wrote-an-oauth-replacement/).

<p align="center"><b>Online demo: <a href="https://iron-session-example.vercel.app/">https://iron-session-example.vercel.app</a> 👀</b></p>

---

_Table of contents:_

- [Installation](#installation)
- [Next.js usage](#nextjs-usage)
- [Next.js middlewares usage](#nextjs-middlewares-usage)
- [Advanced usage](#advanced-usage)
  - [Coding best practices](#coding-best-practices)
  - [Session wrappers](#session-wrappers)
  - [Typing session data with TypeScript](#typing-session-data-with-typescript)
  - [Express](#express)
  - [Koa](#koa)
  - [Handle password rotation/update the password](#handle-password-rotationupdate-the-password)
  - [Magic links](#magic-links)
  - [Impersonation, login as someone else](#impersonation-login-as-someone-else)
  - [Session cookies](#session-cookies)
  - [Firebase usage](#firebase-usage)
- [API](#api)
  - [ironOptions](#ironoptions)
  - [Next.js: withIronSessionApiRoute(handler, ironOptions | (req: NextApiRequest, res: NextApiResponse) => IronOptions | Promise\<IronOptions\>)](#nextjs-withironsessionapiroutehandler-ironoptions--req-nextapirequest-res-nextapiresponse--ironoptions--promiseironoptions)
  - [Next.js: withIronSessionSsr(handler, ironOptions | (req: IncomingMessage, res: ServerResponse) => IronOptions | Promise\<IronOptions\>)](#nextjs-withironsessionssrhandler-ironoptions--req-incomingmessage-res-serverresponse--ironoptions--promiseironoptions)
  - [Express: ironSession(ironOptions)](#express-ironsessionironoptions)
  - [session.save()](#sessionsave)
  - [session.destroy()](#sessiondestroy)
- [FAQ](#faq)
  - [Why use pure cookies for sessions?](#why-use-pure-cookies-for-sessions)
  - [What are the drawbacks?](#what-are-the-drawbacks)
  - [How is this different from JWT?](#how-is-this-different-from-jwt)
- [Project status](#project-status)
- [Credits](#credits)
- [References](#references)
- [Contributors](#contributors)

## Installation

```bash
npm install iron-session
yarn add iron-session
```

## Next.js usage

You can find full featured examples (Next.js, Express) in the [examples folder](examples).

The password is a private key you must pass at runtime and builtime (for getServerSideProps), it has to be at least 32 characters long. You can use https://1password.com/password-generator/ to generate strong passwords.

Session duration is 14 days by default, check the API docs for more info.

⚠️ Always store passwords in encrypted environment variables on your platform. Vercel does this automatically.

**Login API Route:**

```ts
// pages/api/login.ts

import { withIronSessionApiRoute } from "iron-session/next";

export default withIronSessionApiRoute(
  async function loginRoute(req, res) {
    // get user from database then:
    req.session.user = {
      id: 230,
      admin: true,
    };
    await req.session.save();
    res.send({ ok: true });
  },
  {
    cookieName: "myapp_cookiename",
    password: "complex_password_at_least_32_characters_long",
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  },
);
```

**User API Route:**

```ts
// pages/api/user.ts

import { withIronSessionApiRoute } from "iron-session/next";

export default withIronSessionApiRoute(
  function userRoute(req, res) {
    res.send({ user: req.session.user });
  },
  {
    cookieName: "myapp_cookiename",
    password: "complex_password_at_least_32_characters_long",
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  },
);
```

**Logout Route:**

```ts
// pages/api/logout.ts

import { withIronSessionApiRoute } from "iron-session/next";

export default withIronSessionApiRoute(
  function logoutRoute(req, res, session) {
    req.session.destroy();
    res.send({ ok: true });
  },
  {
    cookieName: "myapp_cookiename",
    password: "complex_password_at_least_32_characters_long",
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  },
);
```

**getServerSideProps:**

```ts
// pages/admin.tsx

import { withIronSessionSsr } from "iron-session/next";

export const getServerSideProps = withIronSessionSsr(
  async function getServerSideProps({ req }) {
    const user = req.session.user;

    if (user.admin !== true) {
      return {
        notFound: true,
      };
    }

    return {
      props: {
        user: req.session.user,
      },
    };
  },
  {
    cookieName: "myapp_cookiename",
    password: "complex_password_at_least_32_characters_long",
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  },
);
```

Note: We encourage you to create a `withSession` utility so you do not have to repeat the password and cookie name in every route. You can see how to do that [in the example](./examples/next.js-typescript/lib/session.ts).

## Next.js middlewares usage

As of version 6.2.0, this library is compatible with [Next.js middlewares](https://nextjs.org/docs/advanced-features/middleware) locally and when deployed on Vercel.

Since there's no pre-available `res` object in Next.js's middlewares, you need to use iron-session this way:

```ts
// /middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session/edge";

export const middleware = async (req: NextRequest) => {
  const res = NextResponse.next();
  const session = await getIronSession(req, res, {
    cookieName: "myapp_cookiename",
    password: "complex_password_at_least_32_characters_long",
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  });

  // do anything with session here:
  const { user } = session;

  // like mutate user:
  // user.something = someOtherThing;
  // or:
  // session.user = someoneElse;

  // uncomment next line to commit changes:
  // await session.save();
  // or maybe you want to destroy session:
  // await session.destroy();

  console.log("from middleware", { user });

  // demo:
  if (user?.admin !== "true") {
    // unauthorized to see pages inside admin/
    return NextResponse.redirect(new URL('/unauthorized', req.url)) // redirect to /unauthorized page
  }

  return res;
};

export const config = {
  matcher: "/admin",
};
```

Note: There's a good probability that you can also use iron-session in the context of [Cloudflare Workers](https://workers.cloudflare.com/), try it and let us know.

_Huge thanks to [Divyansh Singh](https://github.com/brc-dd) who ported [hapijs/iron](https://github.com/hapijs/iron) to the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) and implemented the required changes in iron-session._

## Advanced usage

### Coding best practices

Here's an example Login API route that is easier to read because of less nesting:

```ts
// pages/api/login.ts

import { withIronSessionApiRoute } from "iron-session/next";
import { ironOptions } from "lib/config";

export default withIronSessionApiRoute(loginRoute, ironOptions);

async function loginRoute(req, res) {
  // get user from database then:
  req.session.user = {
    id: 230,
    admin: true,
  };
  await req.session.save();
  res.send({ ok: true });
}
```

```ts
// lib/config.ts

export const ironOptions = {
  cookieName: "myapp_cookiename",
  password: "complex_password_at_least_32_characters_long",
  // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};
```

### Session wrappers

If you do not want to pass down the password and cookie name in every API route file or page then you can create wrappers like this:

**JavaScript:**

```js
// lib/withSession.js

import { withIronSessionApiRoute, withIronSessionSsr } from "iron-session/next";

const sessionOptions = {
  password: "complex_password_at_least_32_characters_long",
  cookieName: "myapp_cookiename",
  // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export function withSessionRoute(handler) {
  return withIronSessionApiRoute(handler, sessionOptions);
}

export function withSessionSsr(handler) {
  return withIronSessionSsr(handler, sessionOptions);
}
```

**TypeScript:**

```ts
// lib/withSession.ts

import { withIronSessionApiRoute, withIronSessionSsr } from "iron-session/next";
import {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  NextApiHandler,
} from "next";

const sessionOptions = {
  password: "complex_password_at_least_32_characters_long",
  cookieName: "myapp_cookiename",
  // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export function withSessionRoute(handler: NextApiHandler) {
  return withIronSessionApiRoute(handler, sessionOptions);
}

// Theses types are compatible with InferGetStaticPropsType https://nextjs.org/docs/basic-features/data-fetching#typescript-use-getstaticprops
export function withSessionSsr<
  P extends { [key: string]: unknown } = { [key: string]: unknown },
>(
  handler: (
    context: GetServerSidePropsContext,
  ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>,
) {
  return withIronSessionSsr(handler, sessionOptions);
}
```

**Usage in API Routes:**

```ts
// pages/api/login.ts

import { withSessionRoute } from "lib/withSession";

export default withSessionRoute(loginRoute);

async function loginRoute(req, res) {
  // get user from database then:
  req.session.user = {
    id: 230,
    admin: true,
  };
  await req.session.save();
  res.send("Logged in");
}
```

**Usage in getServerSideProps:**

```ts
// pages/admin.tsx

import { withSessionSsr } from "lib/withSession";

export const getServerSideProps = withSessionSsr(
  async function getServerSideProps({ req }) {
    const user = req.session.user;

    if (user.admin !== true) {
      return {
        notFound: true,
      };
    }

    return {
      props: {
        user: req.session.user,
      },
    };
  },
);
```

### Typing session data with TypeScript

`req.session` is automatically populated with the right types so .save() and .destroy() can be called on it.

But you might want to go further and type your session data also. So you can get autocompletion on `session.user` for example. To do so, use [module augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation):

```ts
// You may need the next line in some situations
// import * as IronSession from "iron-session";

declare module "iron-session" {
  interface IronSessionData {
    user?: {
      id: number;
      admin?: boolean;
    };
  }
}
```

You can put this code anywhere in your project, as long as it is in a file that will be required at some point. For example it could be inside your `lib/withSession.ts` wrapper or inside an [`additional.d.ts`](https://nextjs.org/docs/basic-features/typescript) if you're using Next.js.

We've taken this technique from [express-session types](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/express-session). If you have any comment on

### Express

See [examples/express](examples/express) for an example of how to use this with Express.

### Koa

See [examples/koa](examples/koa) for an example of how to use this with Koa.

### Handle password rotation/update the password

When you want to:

- rotate passwords for better security every two (or more, or less) weeks
- change the password you previously used because it leaked somewhere (😱)

Then you can use multiple passwords:

**Week 1**:

```js
withIronSessionApiRoute(handler, {
  password: {
    1: "complex_password_at_least_32_characters_long",
  },
});
```

**Week 2**:

```js
withIronSessionApiRoute(handler, {
  password: {
    2: "another_password_at_least_32_characters_long",
    1: "complex_password_at_least_32_characters_long",
  },
});
```

**Notes:**

- The password used to encrypt session data (to `seal`) is always the highest number found in the map (2 in the example).
- The passwords used to decrypt session data are all passwords in the map (this is how rotation works).
- Even if you do not provide a list at first, you can always move to multiple passwords afterwards. The first password you've used has a default id of 1.

### Magic links

Because of the stateless nature of `iron-session`, it's very easy to implement patterns like magic links. For example, you might want to send an email to the user with a link to a page where they will be automatically logged in. Or you might want to send a Slack message to someone with a link to your application where they will be automatically logged in.

Here's how to implement that:

**Send an email with a magic link to the user**:

```ts
// pages/api/sendEmail.ts

import { sealData } from "iron-session";

export default async function sendEmailRoute(req, res) {
  const user = getUserFromDatabase(req.query.userId);

  const seal = await sealData(
    {
      userId: user.id,
    },
    {
      password: "complex_password_at_least_32_characters_long",
    },
  );

  await sendEmail(
    user.email,
    "Magic link",
    `Hey there ${user.name}, <a href="https://myapp.com/api/magicLogin?seal=${seal}">click here to login</a>.`,
  );

  res.send({ ok: true });
}
```

The default `ttl` for such seals is 14 days. To specify a `ttl`, provide it in seconds like so:

```ts
const fifteenMinutesInSeconds = 15 * 60;

const seal = await sealData(
  {
    userId: user.id,
  },
  {
    password: "complex_password_at_least_32_characters_long",
    ttl: fifteenMinutesInSeconds,
  },
);
```

**Login the user automatically and redirect:**

```ts
// pages/api/magicLogin.ts

import { unsealData } from "iron-session";
import { withIronSessionApiRoute } from "iron-session/next";

export default withIronSessionApiRoute(magicLoginRoute, {
  cookieName: "myapp_cookiename",
  password: "complex_password_at_least_32_characters_long",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
});

async function magicLoginRoute(req, res) {
  const { userId } = await unsealData(req.query.seal, {
    password: "complex_password_at_least_32_characters_long",
  });

  const user = getUserFromDatabase(userId);

  req.session.user = {
    id: user.id,
  };

  await req.session.save();

  res.redirect(`/dashboard`);
}
```

You might want to include error handling in the API routes. For example checking if `req.session.user` is already defined in login or handling bad seals.

### Impersonation, login as someone else

You may want to impersonate your own users, to check how they see your application. This can be extremely useful. For example you could have a page that list all your users and with links you can click to impersonate them.

**Login as someone else:**

```ts
// pages/api/impersonate.ts

import { withIronSessionApiRoute } from "iron-session/next";

export default withIronSessionApiRoute(impersonateRoute, {
  cookieName: "myapp_cookiename",
  password: "complex_password_at_least_32_characters_long",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
});

async function impersonateRoute(req, res) {
  if (!req.session.isAdmin) {
    // let's pretend this route does not exists if user is not an admin
    return res.status(404).end();
  }

  req.session.originalUser = req.session.originalUser || req.session.user;
  req.session.user = {
    id: req.query.userId,
  };
  await req.session.save();
  res.redirect("/dashboard");
}
```

**Stop impersonation:**

```ts
// pages/api/stopImpersonate.ts

import { withIronSessionApiRoute } from "iron-session/next";

export default withIronSessionApiRoute(stopImpersonateRoute, {
  cookieName: "myapp_cookiename",
  password: "complex_password_at_least_32_characters_long",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
});

async function stopImpersonateRoute(req, res) {
  if (!req.session.isAdmin) {
    // let's pretend this route does not exists if user is not an admin
    return res.status(404).end();
  }

  req.session.user = req.session.originalUser;
  delete req.session.originalUser;
  await req.session.save();
  res.redirect("/dashboard");
}
```

### Session cookies

If you want cookies to expire when the user closes the browser, pass `maxAge: undefined` in cookie options, this way:

```ts
// pages/api/user.ts

import { withIronSessionApiRoute } from "iron-session/next";

export default withIronSessionApiRoute(
  function userRoute(req, res) {
    res.send({ user: req.session.user });
  },
  {
    cookieName: "myapp_cookiename",
    password: "complex_password_at_least_32_characters_long",
    cookieOptions: {
      maxAge: undefined,
      secure: process.env.NODE_ENV === "production",
    },
  },
);
```

Beware, modern browsers might not delete cookies at all using this technique because of [session restoring](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#define_the_lifetime_of_a_cookie).

### Firebase usage

This library can be used with Firebase, as long as you set the cookie name to `__session` which seems to be the only valid cookie name there.

## API

### ironOptions

Only two options are required: `password` and `cookieName`. Everything else is automatically computed and usually doesn't need to be changed.

- `password`, **required**: Private key used to encrypt the cookie. It has to be at least 32 characters long. Use https://1password.com/password-generator/ to generate strong passwords. `password` can be either a `string` or an `array` of objects like this: `[{id: 2, password: "..."}, {id: 1, password: "..."}]` to allow for password rotation.
- `cookieName`, **required**: Name of the cookie to be stored
- `ttl`, _optional_: In seconds. Default to the equivalent of 14 days. You can set this to `0` and iron-session will compute the maximum allowed value by cookies (~70 years).
- [`cookieOptions`](https://github.com/jshttp/cookie#cookieserializename-value-options), _optional_: Any option available from [jshttp/cookie#serialize](https://github.com/jshttp/cookie#cookieserializename-value-options). Default to:

```js
{
  httpOnly: true,
  secure: true, // true when using https, false otherwise
  sameSite: "lax", // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite#lax
  // The next line makes sure browser will expire cookies before seals are considered expired by the server. It also allows for clock difference of 60 seconds maximum between servers and clients.
  maxAge: (ttl === 0 ? 2147483647 : ttl) - 60,
  path: "/",
  // other options:
  // domain, if you want the cookie to be valid for the whole domain and subdomains, use domain: example.com
  // encode, there should be no need to use this option, encoding is done by iron-session already
  // expires, there should be no need to use this option, maxAge takes precedence
}
```

### Next.js: withIronSessionApiRoute(handler, ironOptions | (req: NextApiRequest, res: NextApiResponse) => IronOptions | Promise\<IronOptions\>)

Wraps a [Next.js API Route](https://nextjs.org/docs/api-routes/dynamic-api-routes) and adds a `session` object to the request.

```ts
import { withIronSessionApiRoute } from "iron-session/next";

export default withIronSessionApiRoute(
  function userRoute(req, res) {
    res.send({ user: req.session.user });
  },
  {
    cookieName: "myapp_cookiename",
    password: "complex_password_at_least_32_characters_long",
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  },
);

// You can also pass an async or sync function which takes request and response object and return IronSessionOptions
export default withIronSessionApiRoute(
  function userRoute(req, res) {
    res.send({ user: req.session.user });
  },
  (req, res) => {
    // Infer max cookie from request
    const maxCookieAge = getMaxCookieAge(req);
    return {
      cookieName: "myapp_cookiename",
      password: "complex_password_at_least_32_characters_long",
      // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
      cookieOptions: {
        // setMaxCookie age here.
        maxCookieAge,
        secure: process.env.NODE_ENV === "production",
      },
    };
  },
);
```

### Next.js: withIronSessionSsr(handler, ironOptions | (req: IncomingMessage, res: ServerResponse) => IronOptions | Promise\<IronOptions\>)

Wraps a [Next.js getServerSideProps](https://nextjs.org/docs/basic-features/data-fetching#getserversideprops-server-side-rendering) and adds a `session` object to the request of the context.

```ts
import { withIronSessionSsr } from "iron-session/next";

export const getServerSideProps = withIronSessionSsr(
  async function getServerSideProps({ req }) {
    return {
      props: {
        user: req.session.user,
      },
    };
  },
  {
    cookieName: "myapp_cookiename",
    password: "complex_password_at_least_32_characters_long",
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  },
);

// You can also pass an async or sync function which takes request and response object and return IronSessionOptions
export const getServerSideProps = withIronSessionSsr(
  async function getServerSideProps({ req }) {
    return {
      props: {
        user: req.session.user,
      },
    };
  },
  (req, res) => {
    return {
      cookieName: "myapp_cookiename",
      password: "complex_password_at_least_32_characters_long",
      // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
      },
    };
  },
);
```

### Express: ironSession(ironOptions)

Creates an express middleware that adds a `session` object to the request.

```js
import { ironSession } from "iron-session/express";

app.use(ironSession(ironOptions));
```

### session.save()

Saves the session and sets the cookie header to be sent once the response is sent.

```ts
await req.session.save();
```

### session.destroy()

Empties the session object and sets the cookie header to be sent once the response is sent. The browser will then remove the cookie automatically.

You don't have to call `req.session.save()` after calling `req.session.destroy()`. The session is saved automatically.

## FAQ

### Why use pure cookies for sessions?

This makes your sessions stateless: you do not have to store session data on your server. You do not need another server or service to store session data. This is particularly useful in serverless architectures where you're trying to reduce your backend dependencies.

### What are the drawbacks?

There are some drawbacks to this approach:

- you cannot invalidate a seal when needed because there's no state stored on the server-side about them. We consider that the way the cookie is stored reduces the possibility for this eventuality to happen. Also, in most applications the first thing you do when receiving an authenticated request is to validate the user and their rights in your database, which defeats the case where someone would try to use a token while their account was deactivated/deleted. Now if someone steals a user token you should have a process in place to mitigate that: deactivate the user and force a re-login with a flag in your database for example.
- application not supporting cookies won't work, but you can use [iron-store](https://github.com/vvo/iron-store/) to implement something similar. In the future, we could allow `iron-session` to accept [basic auth](https://tools.ietf.org/html/rfc7617) or bearer token methods too. Open an issue if you're interested.
- on most browsers, you're limited to 4,096 bytes per cookie. To give you an idea, an `iron-session` cookie containing `{user: {id: 100}}` is 265 bytes signed and encrypted: still plenty of available cookie space in here.
- performance: crypto on the server-side could be slow, if that's the case let me know. Also, cookies are sent to every request to your website, even images, so this could be an issue

Now that you know the drawbacks, you can decide if they are an issue for your application or not.
More information can also be found on the [Ruby On Rails website](https://guides.rubyonrails.org/security.html#session-storage) which uses the same technique.

### How is this different from [JWT](https://jwt.io/)?

Not so much:

- JWT is a standard, it stores metadata in the JWT token themselves to ensure communication between different systems is flawless.
- JWT tokens are not encrypted, the payload is visible by customers if they manage to inspect the seal. You would have to use [JWE](https://tools.ietf.org/html/rfc7516) to achieve the same.
- @hapi/iron mechanism is not a standard, it's a way to sign and encrypt data into seals

Depending on your own needs and preferences, `iron-session` may or may not fit you.

## Project status

✅ Production ready and maintained.

## Credits

Thanks to [Hoang Vo](https://github.com/hoangvvo) for advice and guidance while building this module. Hoang built [next-connect](https://github.com/hoangvvo/next-connect) and [next-session](https://github.com/hoangvvo/next-session).

Thanks to [hapi](https://hapi.dev/) team for creating [iron](https://github.com/hapijs/iron).

## References

- https://owasp.org/www-project-cheat-sheets/cheatsheets/Session_Management_Cheat_Sheet.html#cookies
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#samesite-cookie-attribute

## Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="http://www.afterecon.com/"><img src="https://avatars.githubusercontent.com/u/5559355?v=4?s=100" width="100px;" alt=""/><br /><sub><b>John Vandivier</b></sub></a><br /><a href="https://github.com/vvo/iron-session/commits?author=Vandivier" title="Code">💻</a> <a href="#ideas-Vandivier" title="Ideas, Planning, & Feedback">🤔</a> <a href="#example-Vandivier" title="Examples">💡</a></td>
    <td align="center"><a href="https://searchableguy.com"><img src="https://avatars.githubusercontent.com/u/73341821?v=4?s=100" width="100px;" alt=""/><br /><sub><b>searchableguy</b></sub></a><br /><a href="https://github.com/vvo/iron-session/commits?author=searchableguy" title="Tests">⚠️</a> <a href="https://github.com/vvo/iron-session/commits?author=searchableguy" title="Documentation">📖</a> <a href="https://github.com/vvo/iron-session/commits?author=searchableguy" title="Code">💻</a></td>
    <td align="center"><a href="http://brc-dd.me"><img src="https://avatars.githubusercontent.com/u/40380293?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Divyansh Singh</b></sub></a><br /><a href="https://github.com/vvo/iron-session/commits?author=brc-dd" title="Code">💻</a> <a href="https://github.com/vvo/iron-session/commits?author=brc-dd" title="Documentation">📖</a> <a href="#ideas-brc-dd" title="Ideas, Planning, & Feedback">🤔</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
