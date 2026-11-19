# Features

Reference features for the test app that `.github/scripts/build-ddev-site.sh`
builds: the official demo application with its own data, the one route the
script adds (`/{_locale}/test-fixtures/server-error`), and the two accounts of
`cucumber.js` (`administrator`, the demo's `jane_admin`; `user`, the demo's
`john_user`). Copy a feature into your project and replace the addresses,
names and texts with those of your app.

| Feature | Covers |
| --- | --- |
| `session` | The login form, logging in with it, a refused password and an unknown username, an empty password stopped by the browser, a page that needs an account, the session through a reload, logging out, "Keep me logged in", the password field that shows its value. |
| `blog` | The list of posts, a post on its own page, the pager, the tags that filter the list, the search that updates while a reader types, the feed. |
| `comments` | A comment published, the mail its author gets and its link, a comment the rules refuse, an empty comment stopped by the browser, a visitor signed in from a post and sent back to it. |
| `back-office` | The post list and its navigation, the back office in the navigation of an administrator only, a post refused by the browser and by the rules, a post written, changed (tags) and deleted through the confirmation dialog, a post scheduled for a later day, an account refused (403), a visitor sent to the login form. |
| `profile` | The user menu and the profile, a new name and the old one back, an address the rules refuse, a password change refused. |
| `language` | The language chooser, another language that keeps the page, a language written from right to left, the back office in another language. |
| `framework` | The 404, 403, 405 and 500 pages of a live app with no debug information, no debug toolbar and no debug token, no profiler, a login form sent from another site, a form sent with a forged token, a delete form sent with a forged token. |
| `accessibility` | An accessibility audit of the pages a visitor and an account open. |
| `dev-mode` | `@dev-mode`, a lane of its own with the app in the dev environment: the debug toolbar (status, route, account, logged errors, database queries), the profiler and its panels, the debug page of a 404 and of an error nothing catches. |

Scenarios that change something change it back: a post a scenario writes, it
deletes (its comments go with it), a name it changes, it puts back. No scenario
creates or deletes a user or changes a password for good.
