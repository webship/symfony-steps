'use strict';

// The session: logging in by a handle of the users registry or with a username
// and a password, logging out, who is signed in, and the login form.
//
// The login form is the framework's own form login: the fields `_username` and
// `_password` (whatever their labels say), the "remember me" checkbox
// `_remember_me`, and `_target_path`, the page to go to after the login.
//
// Accounts are configuration, not test data: they are listed in cucumber.js
// (`worldParameters.users`) and created once by the build of the app. A
// feature never creates or deletes users.
//
// Every assertion waits on the page (the assertion is the wait), and every
// failure is a friendly error with a hint instead of a raw Playwright timeout.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  siteUrl,
  homePath,
  loginPath,
  accountPath,
  isOnPath,
  currentPath,
  settle,
  open,
  navigating,
  assertPresence,
  resolveUser,
  SESSIONS,
  sessionKey,
  reuseSessions,
  pageMessages,
  pageFieldErrors,
  userMenuTrigger,
  openUserMenu,
  closeMenus,
} = require('./symfony-helpers');

const LOGIN_HINT = 'The login form is at worldParameters.loginPath (/en/login on the demo): a username (or email) field, a password field and a submit button. Check launchUrl and loginPath in cucumber.js.';

/** The login form: the form of the login page that holds a password field. */
function loginForm(world) {
  return world.page.locator('form:has(input[type="password"])').first();
}

/** The field of the login form a person types the username (or address) in, by its label first. */
async function usernameField(world) {
  const form = loginForm(world);
  for (const label of ['Username', 'Email', 'Email address', 'Login']) {
    const byLabel = form.getByLabel(label, { exact: true });
    if (await byLabel.count()) return byLabel.first();
  }
  for (const selector of ['input[name="_username"]', 'input[name="username"]', 'input[name="email"]', 'input[type="email"]', 'input[type="text"]']) {
    const field = form.locator(selector);
    if (await field.count()) return field.first();
  }
  throw friendly({ message: `The login form has no username field (${world.page.url()}).`, hint: LOGIN_HINT });
}

/** The password field of the login form. */
async function passwordField(world) {
  const form = loginForm(world);
  const byLabel = form.getByLabel('Password', { exact: true });
  if (await byLabel.count()) return byLabel.first();
  return form.locator('input[name="_password"], input[type="password"]').first();
}

/** Open the login page as a visitor: the browser forgets the session it had. */
async function openLoginForm(world) {
  await world.page.context().clearCookies();
  world.__sessionKey = null;
  await open(world, siteUrl(world, loginPath(world)));
  try {
    await loginForm(world).waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: `The login form did not appear at ${siteUrl(world, loginPath(world))} (${world.page.url()}).`, cause: err, hint: LOGIN_HINT });
  }
}

/** Tick or untick a checkbox of the login form by its label. */
async function setLoginCheckbox(world, label, checked) {
  const form = loginForm(world);
  let box = form.getByLabel(label, { exact: true });
  if (!(await box.count()) && /remember|logged in/i.test(label)) box = form.locator('input[name="_remember_me"]');
  if (!(await box.count())) {
    const labels = await form.locator('input[type="checkbox"]').evaluateAll((els) => els.map((el) => (el.labels && el.labels[0] && el.labels[0].textContent) || el.name));
    throw friendly({ message: `The login form has no "${label}" checkbox. It has: ${listed(labels)}.`, hint: LOGIN_HINT });
  }
  if ((await box.first().isChecked()) !== checked) await box.first().click();
}

/**
 * Fill in and submit the login form, and wait for the page that answers: the
 * login page again (with the reason it gives), or another page (the login
 * worked). `targetPath` sets `_target_path`, the page the app sends the account
 * to; without it the app decides.
 *
 * @returns {Promise<{error: string}>}
 */
async function submitLogin(world, login, password, { checkbox = null, targetPath = null } = {}) {
  await openLoginForm(world);
  await (await usernameField(world)).fill(login);
  await (await passwordField(world)).fill(password);
  if (checkbox) await setLoginCheckbox(world, checkbox.label, checkbox.checked);
  if (targetPath) {
    await loginForm(world).evaluate((form, value) => {
      let field = form.querySelector('input[name="_target_path"]');
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = '_target_path';
        form.appendChild(field);
      }
      field.value = value;
    }, targetPath);
  }
  const submit = loginForm(world).locator('button[type="submit"], input[type="submit"], button:not([type])').filter({ visible: true }).first();
  await navigating(world, () => submit.click(), { label: `Logging in as "${login}"`, hint: LOGIN_HINT });
  if (!isOnPath(world, loginPath(world))) return { error: '' };
  const messages = (await pageMessages(world)).map((m) => m.text);
  const errors = messages.length ? messages : await pageFieldErrors(world);
  return { error: errors.join(' ') || 'the login page came back without a message' };
}

/** Take over the session an account opened earlier in this run. */
async function restoreSession(world, user) {
  const key = sessionKey(world, user.login);
  const cookies = SESSIONS.get(key);
  if (!cookies || !reuseSessions(world)) return false;
  const context = world.page.context();
  await context.clearCookies();
  await context.addCookies(cookies);
  await open(world, siteUrl(world, homePath(world)));
  if (await userMenuTrigger(world)) {
    world.__sessionKey = key;
    return true;
  }
  // No user menu on that page: ask a page only a signed-in account may open.
  await open(world, siteUrl(world, accountPath(world)));
  if (!isOnPath(world, loginPath(world))) {
    await open(world, siteUrl(world, homePath(world)));
    world.__sessionKey = key;
    return true;
  }
  // The session ended since (a logout, a timeout): log in again.
  SESSIONS.delete(key);
  await context.clearCookies();
  return false;
}

/**
 * Log in as an account of the users registry (`worldParameters.users` in
 * cucumber.js), by its handle. An account that logged in earlier in the run
 * takes its session over; otherwise the step logs in through the login form,
 * asking the app to send it to `homePath` (/en/blog/ on the demo) afterwards.
 *
 * Example #1: Given I am a logged in user with the "administrator" user
 * Example #2: Given we are a logged in user with the "user" user
 * Example #3: Given I am a logged in user with "administrator"
 * Example #4: And I am a logged in user with the "user" user
 * Example #5: Given we are a logged in user with the "administrator" user
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  const user = resolveUser(this, handle);
  if (await restoreSession(this, user)) return;
  const outcome = await submitLogin(this, user.login, user.password, { targetPath: homePath(this) });
  if (outcome.error) {
    throw friendly({
      message: `Could not log in as "${handle}" (${user.login}): ${outcome.error}`,
      hint: 'Check the username and the password of the account in worldParameters.users, and that the build of the app created the account.',
    });
  }
  if (reuseSessions(this)) {
    const key = sessionKey(this, user.login);
    SESSIONS.set(key, await this.page.context().cookies());
    this.__sessionKey = key;
  }
});

/**
 * Log in through the login form as an account of the users registry, as a
 * person does: a new session, never one taken over, and the page the app
 * chooses afterwards. For the scenarios that test the form itself; the step
 * fails when the app refuses the login. A checkbox of the form ("Keep me
 * logged in", "Remember me") can be ticked or unticked on the way.
 *
 * Example #1: When I log in as "administrator" with the login form
 * Example #2: When we log in as "user" with the login form
 * Example #3: When I log in as "user" with the login form and "Keep me logged in" unchecked
 * Example #4: And I log in as "administrator" with the login form and "Keep me logged in" checked
 * Example #5: When we log in as "administrator" with the login form
 */
When(/^(I |we )*log in as "([^"]*)" with the login form(?: and "([^"]*)" (checked|unchecked))?$/, { timeout: 120000 }, async function (pronounCase, handle, checkbox, state) {
  const user = resolveUser(this, handle);
  const outcome = await submitLogin(this, user.login, user.password, { checkbox: checkbox ? { label: checkbox, checked: state === 'checked' } : null });
  if (outcome.error) {
    throw friendly({
      message: `The login form refused "${handle}" (${user.login}): ${outcome.error}`,
      hint: 'Check the username and the password of the account in worldParameters.users, and that the build of the app created the account.',
    });
  }
});

/**
 * Submit the login form with a username (or an email address) and a password.
 * The step does not expect the login to succeed: assert the outcome with the
 * next step (the error message of the login page, the page it sends to).
 *
 * Example #1: When I log in with the username "jane_admin" and the password "wrong-password"
 * Example #2: When we log in with the username "nobody" and the password "Whatever-123!"
 * Example #3: When I log in with the email address "nobody@example.com" and the password "not-a-password"
 * Example #4: And I log in with the username "john_user" and the password "wrong-password"
 * Example #5: When we log in with the username "no_such_account" and the password "kitten"
 */
When(/^(I |we )*log in with the (?:username|email address) "([^"]*)" and the password "([^"]*)"$/, async function (pronounCase, login, password) {
  await submitLogin(this, login, password);
});

/**
 * Log out as a person does: through the logout link of the user menu, or a
 * logout link of the page. The session ends on the server, so no later
 * scenario takes it over.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: Then I log out
 * Example #5: Given I log out
 */
When(/^(I |we )*log out$/, async function (pronounCase) {
  const page = this.page;
  let item = null;
  if (await userMenuTrigger(this)) {
    const { menu } = await openUserMenu(this);
    item = menu.locator('a[href*="logout"], form[action*="logout"] button').first();
  } else {
    const links = page.locator('a[href*="logout"]:visible, form[action*="logout"] button:visible');
    if (await links.count()) item = links.first();
  }
  if (!item) {
    throw friendly({ message: `There is nothing to log out with on this page (${page.url()}): no user menu and no logout link.`, hint: 'Log in first, and open a page of the app with its header.' });
  }
  for (const key of [...SESSIONS.keys()]) {
    if (key === this.__sessionKey) SESSIONS.delete(key);
  }
  this.__sessionKey = null;
  await navigating(this, () => item.click(), { label: 'Logging out', hint: 'The logout route sends the browser on to another page (the home page of the demo).' });
});

/**
 * Assert that somebody is, or nobody is, logged in. The step opens a page only
 * a signed-in account may open (`accountPath`, /en/profile/edit on the demo):
 * a visitor is sent to the login form instead.
 *
 * Example #1: Then I should be logged in
 * Example #2: Then I should not be logged in
 * Example #3: Then we should be logged in
 * Example #4: And we should not be logged in
 * Example #5: But I should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  await open(this, siteUrl(this, accountPath(this)));
  const signedIn = !isOnPath(this, loginPath(this));
  if (notCase && signedIn) {
    throw friendly({ message: `Expected nobody to be logged in, but ${accountPath(this)} opened without the login form (${this.page.url()}).`, hint: 'Log out first (I log out), or start from a new visitor (I am an anonymous user).' });
  }
  if (!notCase && !signedIn) {
    throw friendly({ message: `Expected to be logged in, but ${accountPath(this)} sent the browser to the login form.`, hint: 'Log in first (I am a logged in user with the "..." user).' });
  }
});

/**
 * Assert who is logged in, by a handle of the users registry: the user menu
 * of the header names the account (its `name` in the registry, else its
 * username).
 *
 * Example #1: Then I should be logged in as "administrator"
 * Example #2: Then we should be logged in as "user"
 * Example #3: And I should be logged in as "user"
 * Example #4: Then I should be logged in as "administrator"
 * Example #5: And we should be logged in as "administrator"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  if (!(await userMenuTrigger(this))) await open(this, siteUrl(this, homePath(this)));
  const trigger = await userMenuTrigger(this);
  if (!trigger) {
    throw friendly({ message: `Expected "${handle}" (${user.login}) to be logged in, but nobody is: ${currentPath(this)} has no user menu.`, hint: 'Log in first (I am a logged in user with the "..." user).' });
  }
  const shown = clean(await trigger.innerText().catch(() => ''));
  await closeMenus(this);
  const names = [user.name, user.username, user.email].filter(Boolean).map((n) => n.toLowerCase());
  if (!names.includes(shown.toLowerCase())) {
    throw friendly({ message: `Expected "${handle}" (${user.name || user.login}) to be logged in, but the user menu names "${shown}".`, hint: 'The user menu shows the name of the signed-in account: set worldParameters.users.<handle>.name to the name the app shows.' });
  }
});

/**
 * Assert that the page shows, or does not show, the login form (a password
 * field and a submit button), on the login page, for instance after a page
 * that needs a session sent a visitor to it.
 *
 * Example #1: Then I should see the login form
 * Example #2: Then I should not see the login form
 * Example #3: And we should see the login form
 * Example #4: Then we should not see the login form
 * Example #5: But I should see the login form
 */
Then(/^(I |we )*should( not)* see the login form$/, async function (pronounCase, notCase) {
  await settle(this);
  await assertPresence(this.page.locator('form:has(input[type="password"]):has(button[type="submit"], input[type="submit"])'), notCase, {
    label: 'the login form',
    hint: LOGIN_HINT,
    timeout: budget(this),
    found: async () => `The page is ${this.page.url()} ("${clean(await this.page.title())}").`,
  });
  if (!notCase && !isOnPath(this, loginPath(this))) {
    throw friendly({ message: `A login form is on the page, but the page is ${currentPath(this)}, not ${loginPath(this)}.`, hint: 'Check worldParameters.loginPath in cucumber.js.' });
  }
});
