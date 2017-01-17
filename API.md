# Yarnemia

## API Reference

### Options

- `name` - determines the name of the cookie used to store session information. Defaults to _session_.
- `storeBlank` - determines whether to store empty session before they've been modified. Defaults to _true_.
- `cache` - **hapi** [cache options](https://github.com/hapijs/hapi/blob/master/API.md#servercacheoptions) which includes
  (among other options):
    - `expiresIn` - server-side storage expiration (defaults to 1 day).
- `cookieOptions` - the configuration for cookie-specific features:
    - `path` - determines the cookie path. Defaults to _'/'_.
    - `isSameSite` - enables the `same-site` cookie parameter.  Default to 'Lax'.  Can be `'Strict'|'Lax'|false`.
    - `isSecure` - determines whether or not to transfer using TLS/SSL. Defaults to _true_.
    - `isHttpOnly` - determines whether or not to set HttpOnly option in cookie. Defaults to _true_.
    - `ttl` - sets the time for the cookie to live in the browser, in milliseconds.  Defaults to null (session time-life - cookies are deleted when the browser is closed).

#### Route Options
You can also add these options on a route per route basis at `config.plugins.yarnemia`:
  - `skip` - a boolean value which, if true, means no session with be attached to the request (defaults to false).

#### Methods

**Yarnemia** adds the `yarnemia` property to every request object and initializes the `yarnemia.id` on the first request from each browser. The `request.yarnemia` interface provides the following methods:

- `reset()` - clears the session and assigns a new session id.
- `set(key, value)` - assigns a value (string, object, etc) to a given key which will persist across requests.  Returns the value.
- `set(keysObject)` - assigns values to multiple keys using each 'keysObject' top-level property. Returns the keysObject.
- `get(key, clear)` - retrieve value using a key. If 'clear' is 'true', key is cleared on return.
- `clear(key)` - clears key.
- `touch()` - Manually notify the session of changes (when using `get()` and changing the content of the returned reference directly without calling `set()`).
- `flash(type, message, isOverride)` - stores volatile data - data that should be deleted once read. When given no arguments, it will return all of the flash messages and delete the originals. When given only a type, it will return all of the flash messages of that type and delete the originals. When given a type and a message, it will set or append that message to the given type. 'isOverride' used to indicate that the message provided should replace any existing value instead of being appended to it (defaults to false).
- `lazy(enabled)` - if set to 'true', enables lazy mode. In lazy mode, `request.yarnemia` can be modified directly (e.g. setting `request.yarnemia.myKey` to an object value), and those keys will be stored and loaded back. Lazy mode isn't as fast as the normal get/set because it has to store the session state on every responses regardless of any changes being made.
