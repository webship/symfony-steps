<p align="center"><img src="https://raw.githubusercontent.com/webship/symfony-steps/2.0.x/assets/logo.svg" alt="Symfony logo" width="96"></p>

# symfony-steps

Cucumber step definitions for testing Symfony apps with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

A framework ships no fixed pages, so `@webship-js/symfony-steps` targets two
things. First, what the framework itself gives every app, the same way in each
one: the form login and the session, the messages a page shows after an action
(the flash messages), the errors the form themes print under a field, the
CSRF protection that refuses a forged form, the error pages of a live app, and
the debug toolbar and the profiler of a development one, with the check that a
live app shows neither. Second, the official Symfony Demo application, the app
the framework's own documentation is written around: its blog, the pager and
the tags of the list, the comments and the mail an author gets, the search that
updates while a reader types, the back office (posts written, changed and
deleted through a confirmation dialog, a tags field, a date picker), the
profile, and the language chooser. The steps are proven on the demo's current
release (Symfony 8.1) and on its release for Symfony 7.4, the long-term-support
line.

No step phrase names the framework or a library: a scenario reads `Given I am a
logged in user with the "administrator" user` and `Then I should see the 404
error page`.

CI builds the real demo with [DDEV](https://ddev.com) on the runner, the way
its own installation guide says (`composer create-project
symfony/symfony-demo`), once per release line, and runs the whole suite
against each, twice, on every push and pull request, then the assertions that
must fail, then a lane with the app in the dev environment; see
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and Node.js 20 or later with npm. PHP, Composer, the database and the mail catcher run in DDEV's containers.

**1. The app.** The pack's own build script (the one CI runs) makes the official demo application in a DDEV project of type `symfony`: `composer create-project symfony/symfony-demo`, the demo's own data loaded with its fixtures into the database DDEV gives the project (the demo's users get addresses at example.com), then the app runs as a live app runs (`APP_ENV=prod`, `APP_DEBUG=0`, its assets compiled). It adds one page of its own, an error nothing catches, for the 500 page. It takes one to three minutes.

```bash
git clone https://github.com/webship/symfony-steps.git
SITE_DIR="$PWD/symfony-app" symfony-steps/.github/scripts/build-ddev-site.sh
```

The app answers at `https://symfonysteps.ddev.site` and its mailbox at `https://symfonysteps.ddev.site:8026`. Its accounts are the demo's own users, `jane_admin` and `john_user` (step 3 names them).

In the [Webship Workspace](https://github.com/webship/workspace), its Symfony plugin builds the same demo instead, in a sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/` and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require symfony --with-needs
bash core/scripts/plugins.sh --activate symfony --with-needs
bash core/scripts/plugins.sh --install symfony
bash dev/cmd-symfony-project.sh mysite --install --add-users --demo --production
```

That app answers at `https://mysite.ddev.site` and its mailbox at `https://mysite.ddev.site:8026`. `--demo` makes the official demo application (without it the builder makes a new web app), `--install` loads the demo's data, and `--production` runs it as the script's app runs (the error pages, never the debug page or the toolbar). Its accounts are the plugin's: `administrator` (an administrator of the demo) and `user`, each named as its handle, with the workspace's shared password `dD.123123ddd` (step 3 names them); the demo's own users are there too. It has none of the one page the script adds for the 500 page, which one scenario of [`tests/features/framework.feature`](tests/features/framework.feature) and the `@dev-mode` lane open; this adds it, from the workspace folder:

```bash
cat > dev/mysite/src/Controller/TestFixturesController.php <<'PHPEOF'
<?php

// Added by the test app of the webship-js suite: an error nothing catches.

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class TestFixturesController extends AbstractController
{
    #[Route('/test-fixtures/server-error', name: 'test_fixtures_server_error', methods: ['GET'])]
    public function serverError(): Response
    {
        throw new \RuntimeException('The test app raised this error on purpose.');
    }
}
PHPEOF
rm -rf dev/mysite/var/cache/prod
```

The last line empties the cache of the live app, so its next request reads the new route.

**2. A test project.**

```bash
mkdir symfony-tests && cd symfony-tests
npm init -y
npm install --save-dev webship-js @webship-js/symfony-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the tags that keep the dev lane out of a normal run, the address of the app and of its mailbox, the pages the steps open, and the accounts (the JSON of [Test users](#test-users)).

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/symfony-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    // Work in progress, the assertions that must fail, and the lane that needs the app in the dev
    // environment (@dev-mode: the debug toolbar and the profiler) stay out of a normal run.
    tags: 'not @wip and not @must-fail and not @dev-mode',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://symfonysteps.ddev.site',
      mailUrl: (process.env.LAUNCH_URL || 'https://symfonysteps.ddev.site') + ':8026',
      // The page the login step sends an account to, the login page, and a page only an account may open.
      homePath: '/en/blog/',
      loginPath: '/en/login',
      accountPath: '/en/profile/edit',
      reuseSessions: true,
      // The browser logs "Failed to load resource: the server responded with a status of 422" for every
      // form the app refuses (422 is the status of a form with errors): not a fault of the app. The
      // scenarios that open an error page carry @js-off, so the warning mode stays on for every other page.
      javascript: { mode: 'warn', levels: ['error'], ignore: 'the server responded with a status of 422' },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        administrator: { username: 'jane_admin', password: 'kitten', name: 'Jane Doe', email: 'jane_admin@example.com' },
        user: { username: 'john_user', password: 'kitten', name: 'John Doe', email: 'john_user@example.com' },
      },
    },
  },
};
```

On an app from the Webship Workspace (step 1), the accounts are the plugin's: `administrator: { username: 'administrator', password: 'dD.123123ddd', name: 'administrator', email: 'administrator@example.com' }` and `user: { username: 'user', password: 'dD.123123ddd', name: 'user', email: 'user@example.com' }`, and `mailUrl` follows `LAUNCH_URL`. Its address goes in `LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: An administrator logs in and opens the post list
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/"
    Then I should see "Post List"
    And I should be logged in as "administrator"

  @js-off
  Scenario: An address the app does not have answers with the 404 page
    Given I am an anonymous user
    When I go to "/en/no-such-page-of-the-app"
    Then I should see the 404 error page
    And the page should not show debug information
```

**5. Run it.** Set `LAUNCH_URL` to the address of the app: `https://symfonysteps.ddev.site` for the build script's app, `https://mysite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://symfonysteps.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
10 steps (10 passed)
0m03.912s (executing steps: 0m03.882s)
[webship-js] HTML report → …/symfony-tests/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under `node_modules/@webship-js/symfony-steps/tests/features/`): together they use every step of the pack. They read no file of their own. On a Workspace app they run as they are, but for the one page of step 1 they need (`/en/test-fixtures/server-error`).

### What the suite tests

The features of this repository run every step of the pack against the test app, twice in a row in CI on every change, then the assertions that must fail, then the lane with the app in the dev environment: the login form, logging in with it, a refused password and an unknown username, an empty password stopped by the browser, a page that needs an account, the session through a reload, logging out, "Keep me logged in" and its cookie, the password field that shows its value; the list of posts, a post on its own page, the pager, a tag that filters the list, the search that updates while a reader types, the feed; a comment published, the mail its author gets and the link in it, a comment the rules refuse, an empty one stopped by the browser, a visitor signed in from a post and sent back to it; the post list of the back office and its navigation, a post refused by the browser and by the rules, a post written, changed (its tags) and deleted through the confirmation dialog, a post scheduled for a later day, an account refused (403), a visitor sent to the login form; the profile, a new name and the old one back, an address the rules refuse, a password change refused; the language chooser, another language that keeps the page, a language written from right to left; the 404, 403, 405 and 500 pages with no debug information, no debug toolbar and no debug token in a live app, no profiler, a login form sent from another site, a form and a delete form sent with a forged token; an accessibility audit of the pages a visitor and an account open; and (`@dev-mode`) the debug toolbar, the profiler and the debug page of a development app.

Not tested: creating or deleting an account (the suite never does), a password changed for good (it logs the account out), and the pages an app adds of its own.

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A Symfony app (the steps for the blog, the comments and the back office are written for the official demo application), and accounts on it for the suite

## Install

```bash
npm install --save-dev @webship-js/symfony-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/symfony-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the app, name the pages the steps open, and the accounts
   the suite logs in with (see [Accounts](#accounts)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-app.ddev.site',
     homePath: '/en/blog/',          // where the login step sends an account
     loginPath: '/en/login',         // the login page
     accountPath: '/en/profile/edit', // a page only an account may open
     mailUrl: 'https://your-app.ddev.site:8026', // the mailbox of the app (Mailpit), for the mail steps
     users: {
       administrator: { username: 'admin', password: process.env.ADMINISTRATOR_PASSWORD, name: 'The Admin', email: 'admin@example.com' },
     },
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and replace the addresses, names and texts with those of your app.

```gherkin
Feature: A post refused by the rules

  Scenario: Content that is too short comes back with the reason under its field
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the webship-js suite"
    And I fill in "Summary" with "A summary."
    And I fill in "Content" with "Too short"
    And I press "Create post"
    Then the response status code should be 422
    And the "Content" field should have the error "Post content is too short (10 characters minimum)"
    And the "Title" field should have no error
```

## What is included

| File | Steps | Covers |
| --- | --- | --- |
| `symfony-session.steps.js` | 7 | Login by a handle of the users registry (a session taken over when the account already has one), login through the form (with a checkbox of the form on the way), login with a username or an address and a password, logout, who is signed in, the login form. |
| `symfony-forms.steps.js` | 15 | A field filled with a value of an account of the registry, a field that holds one, the error under a field (or none), a field the browser refuses as empty, an error of the whole form, a form sent with a forged token, the messages of a page by kind, closing a message, the button that shows a password, a tags field, a date picker. |
| `symfony-app.steps.js` | 9 | The user menu (open an item, what it offers, the account it names), the navigation (its items, the current page), the language chooser (choose one, what it offers, the current one), the direction the page is written in. |
| `symfony-blog.steps.js` | 16 | The posts of a list, a post opened by its title, its author and its tags, a tag that filters the list, the pager, the comments and the comment form, a field that updates the page while a person types in it. |
| `symfony-errors.steps.js` | 12 | The error page of a status, the debug information a live app must not show, a form sent from another site, the debug toolbar (status, route, account, logged errors, database queries), the profiler (the request, its panels). |
| `symfony-mail.steps.js` | 4 | The mail the app sends (subject, text, no mail), a link of a mail opened as a person does. |
| `symfony-helpers.js` | | Shared plumbing for the files above and for your own steps: the wait budget, the requests of the page, friendly errors, the users registry and the session cache, fields and their errors, messages, the user menu, the navigation, the language chooser, the mailbox, the status of the page, the debug toolbar. It registers no step. |

Text, links, the plain filling of fields, buttons, dialogs, table rows, cookies,
the status code and the headers of a page and the accessibility audit are
webship-js's own steps (`I should see "..."`, `I fill in "..." with "..."`,
`I press "..."`, `I click the "Delete post" button`, `I click "Delete post" in
the modal`, `I click "Edit" in the "..." row`, `a cookie with the name
"REMEMBERME" should exist`, `the response should not contain the header
"x-debug-token"`, `the response status code should be 422`, `the page should
have no critical accessibility violations`): this pack adds only what the
framework and the demo decide.

## How the steps find things and wait

- **By what a person reads.** A field is found by its label (also one only
  screen readers read), else its name; an error by the field it belongs to; a
  post by its title; a language by the name it shows. What the framework
  prints the same way in every app is the fallback: the fields of the form
  login (`_username`, `_password`, `_remember_me`, `_target_path`), the ids and
  classes the form themes give an error (`<id>_error1` named by the field's
  `aria-describedby`, `.invalid-feedback`, `.form-error-message`), the
  `hreflang` of the language links, the blocks of the debug toolbar.
- **Any language.** The user menu is the dropdown of the header that holds
  the logout link, and the language chooser is the set of links that say which
  language they lead to: both are found on a page in Spanish or Arabic as on a
  page in English.
- **No fixed sleeps.** The steps wait on the page's own signals: the page a
  form or a link leads to, the error that appears under a field, the message
  after an action, the debug toolbar's own request, and, for a field that
  updates the page while a person types (the search of the demo), the
  component around it: it is marked busy while its request runs and carries the
  value it was rendered with, and the step waits for both.
- **The login step chooses the page it lands on.** `I am a logged in user with
  the "..." user` sends `_target_path` (the page to go to after the login,
  `homePath`) with the form, so the next step starts from a known page; `I log
  in as "..." with the login form` leaves the choice to the app, as a person
  who signs in does.
- **Failures say what was found.** `Expected the error "Your post should have
  some content!" for the "Content" field. It shows: "Post content is too short
  (10 characters minimum)".` with a hint on where to look.

## Accounts

The suite never creates or deletes a user. Accounts are configuration: list
the ones the app has in `worldParameters.users`, by a handle the scenarios
use, each with its `username` (or `email`, when the app logs in by address) and
`password`, and for the steps that check or fill them its `name` (the name the
app shows) and `email`.

```javascript
users: {
  administrator: { username: 'jane_admin', password: process.env.ADMINISTRATOR_PASSWORD, name: 'Jane Doe', email: 'jane_admin@example.com' },
  user: { username: 'john_user', password: process.env.USER_PASSWORD, name: 'John Doe', email: 'john_user@example.com' },
},
```

An account that logged in once keeps its session for the rest of the run: a
later scenario that logs in as the same handle takes the session over instead
of filling in the login form again. `reuseSessions: false` in
`worldParameters` turns that off.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js`
lists them in `worldParameters.users` (the default values; the `*_USERNAME`,
`*_PASSWORD`, `*_NAME` and `*_EMAIL` variables replace them). They are the
demo's own users, which its fixtures create and its login page lists; the
build script moves their addresses to example.com.

```json
{
  "administrator": { "username": "jane_admin", "password": "kitten", "name": "Jane Doe", "email": "jane_admin@example.com" },
  "user": { "username": "john_user", "password": "kitten", "name": "John Doe", "email": "john_user@example.com" }
}
```

`administrator` has the role of an administrator of the demo (the back office)
and writes the newest post; `user` is a reader who comments.

## A test app

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
builds the app the suite of this repository runs against, the documented way:
a DDEV project of type `symfony` with PHP 8.4 and Node.js 24, the official demo
application made with Composer (`composer create-project
symfony/symfony-demo`; `DEMO_VERSION=2.9.0` for the release on Symfony 7.4,
the long-term-support line). Then:

- the demo's data, loaded the way its own login page tells a person to: its
  schema, then its fixtures, into the database DDEV gives the project
  (MariaDB; DDEV writes its address and the mail catcher's into `.env.local`),
  with the addresses of the demo's users moved to example.com;
- one route, `/{_locale}/test-fixtures/server-error`, an error nothing
  catches, for the 500 page ([`site/TestFixturesController.php`](site/TestFixturesController.php));
- `APP_ENV=prod` and `APP_DEBUG=0`, as a live app runs: an error renders the
  error page, never the debug page, there is no debug toolbar, and the assets
  are compiled.

```bash
SITE_DIR="$PWD/../symfony-app" .github/scripts/build-ddev-site.sh
npm test
```

Nothing is installed that the demo does not bring: no paid package, no trial,
no sign-in to any service.

The demo's data has a few things a scenario must not count on: the authors and
the tags of its posts (but the newest one) are drawn at random when it is
loaded, and its newest post is published at a random hour of that day, so it
may not be on the blog yet. The features start from the second post,
"Pellentesque vitae velit ex", and assert authors and tags only through what
they see.

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `symfony-session.steps.js` (7)

- `Given I am a logged in user with the "administrator" user`
- `When I log in as "administrator" with the login form`
- `When I log in with the username "jane_admin" and the password "wrong-password"`
- `When I log out`
- `Then I should be logged in`
- `Then I should be logged in as "administrator"`
- `Then I should see the login form`

### `symfony-forms.steps.js` (15)

- `When I fill in "Password" with the password of "user"`
- `Then the "Fullname" field should hold the name of "administrator"`
- `Then the "Content" field should have the error "Post content is too short (10 characters minimum)"`
- `Then the "Title" field should have no error`
- `Then the "Title" field should block submission as required`
- `Then the form should have the error "The CSRF token is invalid. Please try to resubmit the form."`
- `When I press "Save changes" with a forged token`
- `Then I should see the success message "Post created successfully!"`
- `When I close the message "Post created successfully!"`
- `When I show the value of the "Password" field`
- `Then the "Password" field should show its value`
- `When I add the tag "lorem" to the "Tags" field`
- `When I remove the tag "lorem" from the "Tags" field`
- `Then the "Tags" field should have the tags "lorem"`
- `When I set the "Published at" date to "2030-01-01 10:00"`

### `symfony-app.steps.js` (9)

- `When I open "Account" from the user menu`
- `Then the user menu should offer "Account"`
- `Then the user menu should name "administrator"`
- `Then the navigation should have the item "Search"`
- `Then the navigation should show "Homepage" as the current page`
- `When I choose the language "Español"`
- `Then the language chooser should offer "Deutsch"`
- `Then the current language should be "English"`
- `Then the page should be written from right to left`

### `symfony-blog.steps.js` (16)

- `Then the page should list 10 posts`
- `Then I should see the post "Pellentesque vitae velit ex"`
- `When I open the post "Pellentesque vitae velit ex"`
- `Then the post "Lorem ipsum dolor sit amet consectetur adipiscing elit" should be written by "Jane Doe"`
- `Then the post "A post of the webship-js suite" should have the tag "lorem"`
- `When I filter the posts by the tag "lorem"`
- `Then every post should have the tag "lorem"`
- `When I go to page 2 of the list`
- `When I go to the next page of the list`
- `Then the list should be on page 2`
- `Then the list should have 3 pages`
- `Then the list should have no previous page`
- `When I publish the comment "A comment of the webship-js suite."`
- `Then the post should have 5 comments`
- `Then I should see the comment "A comment of the webship-js suite." by "user"`
- `When I type "vulputate" in the "Search for..." field`

### `symfony-errors.steps.js` (12)

- `Then I should see the 404 error page`
- `Then the page should not show debug information`
- `When a page of another site sends a form to "/en/login"`
- `Then I should see the debug toolbar`
- `Then the debug toolbar should show the status code 200`
- `Then the debug toolbar should show the route "blog_index"`
- `Then the debug toolbar should show the account "administrator"`
- `Then the debug toolbar should show 0 logged errors`
- `Then the debug toolbar should show at most 10 database queries`
- `When I open the profiler of the page`
- `Then the profiler should show the "GET" request to "/en/blog/"`
- `When I open the "Logs" panel of the profiler`

### `symfony-mail.steps.js` (4)

- `Then an email with the subject "Your post received a comment!" should be sent to "administrator"`
- `Then no email should be sent to "user"`
- `Then the email with the subject "Your post received a comment!" to "administrator" should contain "has received a new comment"`
- `When I open the "this link" link of the email to "administrator"`

## Testing this package

```bash
npm install
SITE_DIR="$PWD/../symfony-app" .github/scripts/build-ddev-site.sh
npm run test:examples      # the examples and the features against the step patterns
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
npm test                   # the suite, against the app
npm run test:must-fail     # assertions that must fail, each with its message
```

The dev lane needs the app in the dev environment, and puts it back:

```bash
(cd ../symfony-app && ddev dotenv set .env.local --app-env=dev --app-debug=1 && ddev exec bin/console cache:clear)
npm run test:dev-mode                        # the debug toolbar, the profiler, the debug page
MUST_FAIL_TAGS=@dev-mode npm run test:must-fail
(cd ../symfony-app && ddev dotenv set .env.local --app-env=prod --app-debug=0 && ddev exec bin/console cache:clear)
```

`LAUNCH_URL` points the suite at another app; `npx cucumber-js
tests/features/session.feature` runs one feature and `npx cucumber-js
tests/features/session.feature:<line>` one scenario (the line of its
`Scenario:`; the paths of `cucumber.js` are left out when the command line
names any); `FEATURES` runs a subset too
(`FEATURES=tests/features/session.feature npm test`); `CUCUMBER_TAGS=@critical`
runs the smoke lane; `HEADLESS=false` shows the browser.

`tests/must-fail/` holds scenarios that assert something that is not true on
the test app. `npm run test:must-fail` runs them and checks that each one
fails at its last step, with the message it announces and a hint: a step that
cannot fail proves nothing. A few of them write a post to have a comment or a
mail to fail on; the scenarios tagged `@must-fail-cleanup` run after them and
delete those posts.

The suite leaves the app as it found it: a post a scenario writes, it deletes
(its comments go with it), a name it changes, it puts back. A run stopped half
way can leave a post or a changed name; the build script loads the demo's data
again without building anything:

```bash
FIXTURES_ONLY=1 SITE_DIR="$PWD/../symfony-app" .github/scripts/build-ddev-site.sh
```

## How the steps were written

Every page a step touches was opened in a real browser first, and the step was
written from what is there: the roles and names of the accessibility tree, the
stable attributes, what the page does while it loads or saves, the exact
messages. The steps are proven on the official demo application, its release
3.1.0 on Symfony 8.1 and its release 2.9.0 on Symfony 7.4, in US English (and
Spanish, German and Arabic for the language chooser), with Chromium.

Not covered: the pages the official maker generates (a registration form, a
CRUD of its own), an admin panel bundle, two-factor authentication and login
links, the forms of an app without the Bootstrap form theme beyond the field
errors, and an app's own pages.

## License

MIT

## Logo

The Symfony logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The Symfony name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
