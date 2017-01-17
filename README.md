[![CircleCI](https://circleci.com/gh/pmoons/yarnemia.svg?style=svg)](https://circleci.com/gh/pmoons/yarnemia)
[![codecov](https://codecov.io/gh/pmoons/yarnemia/branch/master/graph/badge.svg)](https://codecov.io/gh/pmoons/yarnemia)
[![Code Climate](https://codeclimate.com/github/pmoons/yarnemia/badges/gpa.svg)](https://codeclimate.com/github/pmoons/yarnemia)

A [**HapiJS**](https://github.com/hapijs/hapi) session plugin and cookie jar without unnecessary [Iron](https://github.com/hueniverse/iron) cookie encryption

Lead Maintainer: [Peter Mooney](https://github.com/pmoons)

Forked from [Yar](https://github.com/hapijs/yar) a maintained module by [Mark Bradshaw](https://github.com/mark-bradshaw)

## Install (only for Hapi >= 14.0.0)

    $ npm install yarnemia --save
    or
    $ yarn add yarnemia

## About

The ***yarnemia*** [hapi](https://github.com/hapijs/hapi) plugin adds session support - a persistent state across multiple browser
requests using server-side storage. It uses server storage
via the [hapi plugin cache](http://hapijs.com/api#servercacheoptions) interface. The difference between Yar and Yarnemia is the use of an [iron](https://github.com/hueniverse/iron) encrypted cookie.

**Yarnemia** attempts to enforce good practice by storing all important session data on the server side. The only piece of data that should be in a cookie is the session identifier used to match up the session data on the server. Due to this deviation from [yar](https://github.com/hapijs/yar), there is no need for encrypting and decrypting the cookie. An encrypted token containing only the session identifier would behave the exact same way an unencrypted token would.  Removing this unnecessary encryption step will remove the negative performance impact of encrypting and decrypting the cookie.

## Differences
- `customSessionIDGenerator` function has been removed.  Allowing someone to provide their own ID generation logic opens up the possibility of implementing something that is not cryptographically random, possibly enabling an attacker to guess session ids of other users.  The current ID Generator is UUID v4.
- `errorOnCacheNotReady` flag has been removed as an available option.  This flag was silly and could easily break the expectations a developer would have around the status of the session manager. Also, since session data can now only be stored in one place (sever-side cache) and not the cookie, it makes sense to throw an error for an unprepared cache. Cache defaults to local server cache [Catbox-Memory](https://github.com/hapijs/catbox-memory)
- `isHttpOnly` flag has had the default changed to `true`. This helps prevent XSS attacks by preventing the cookie from being read by JavaScript.

## Usage
Other than what is mentioned above, there are virtually no differences between the `yar` API and `yarnemia`'s.  All store data will be scoped per user based on session id provided in the header.

```javascript
var handler1 = function (request, reply) {

    request.yarnemia.set('example', { key: 'value' });
    return reply();
};

var handler2 = function (request, reply) {

    var example = request.yarnemia.get('example');
    reply(example.key);     // Will send back 'value'
};
```

Setup up **yarnemia** is simple.
```javascript
var options = {
    storeBlank: false,
    cookieOptions: {
        isSecure: true
    }
};

/*
  Please note that there are other default cookie options that can impact your security.
  Please look at the description of the cookie options below to make sure this is doing
  what you expect.
*/

var server = new Hapi.Server();

server.register({
    register: require('yarnemia'),
    options: options
}, function (err) { });
```

## Cookie Options

You can read about more cookie options in the [Api](API.md).

### isSecure

Set `isSecure` (default `true`) to `false` if you are using standard http. Take care to do this in development mode only though. You don't want to use cookies sent over insecure channels for session management.  One way to take care of this is to use the `NODE_ENV` environment variable like this:

```javascript
var options = {
    cookieOptions: {
        isSecure: process.env.NODE_ENV !== 'development',
        ...
    }
};
```

### clearInvalid

`clearInvalid` (default `true`) tells Hapi that if a session cookie is invalid for any reason, to clear it from the browser.  This prevents Hapi from having to reprocess the bad cookie on future requests.  In general you'll probably want this on, but if you'd prefer that session cookies be dealt with in some other way you may set this to `false`.

## API Reference

[Api Reference](API.md)
