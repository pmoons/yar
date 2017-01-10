A [**hapi**](https://github.com/hapijs/hapi) session plugin and cookie jar without unnecessary [Iron](https://github.com/hueniverse/iron) cookie encryption

Lead Maintainer: [Peter Mooney](https://github.com/pmoons)

Forked from [Yar](https://github.com/hapijs/yar), maintained by [Mark Bradshaw](https://github.com/mark-bradshaw)

## Install

    $ npm install yarnemia --save
    or
    $ yarn add yarnemia

## Hapi < 14.0.0

If you are using an older version of Hapi then you'll want to use version 7.0.2 of yarnemia.  Starting with version 8.0.0 of yarnemia we only support later versions of Hapi due to a third party dependency issue.

## Upgrading to 6.x.x and greater

Starting with Hapi 12 the `request.session` placeholder was removed.  The guidance from Hapi maintainer Eran Hammer was for this and similar modules to move data storage away from request.session and use a more unique location.  So, starting in 6.x.x the yarnemia storage has been moved to `request.yar`.  All the functionality remains the same, but it just lives in a different location.  I apologize in advance for the inconvenience this may cause but updating your code should be fairly straight forward.

## About

The ***yarnemia*** [hapi](https://github.com/hapijs/hapi) plugin adds session support - a persistent state across multiple browser
requests using server-side storage. It uses server storage
via the [hapi plugin cache](http://hapijs.com/api#servercacheoptions) interface. The difference between Yar and Yarnemia is the use of an [iron](https://github.com/hueniverse/iron) encrypted cookie.

**Yarnemia** attempts to enforce good practice by storing all important session data on the server side. The only piece of data that should be in a cookie is the session identifier used to match up the session data on the server. Due to this deviation from [yar](https://github.com/hapijs/yar), there is no need for encrypting and decrypting the cookie, because the only piece of data the client could have tampered with is the session id, which would simply fail to match up to any known session stored on the server. Removing this unnecessary encryption step will remove the negative performance impact of encrypting and decrypting the cookie.

## Usage

The first handler sets a session key and the second gets it:
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

## Hapi-Auth-Cookie

There's a similar project called [Hapi-Auth-Cookie](https://github.com/hapijs/hapi-auth-cookie) that achieves similar ends to *yarnemia*.  If you want some additional options around authentication then you should take a look there.

## API Reference

[Api Reference](API.md)
