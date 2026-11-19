'use strict';

// The framework's own pages and tools: the error page of a status, the check
// that a live app shows no debug information, a form sent to the app from
// another site (refused by the CSRF protection), and, in a development app,
// the debug toolbar at the foot of every page and the profiler it leads to.
//
// The status a step reads is the one the browser received for the page on
// screen (webship-js records it for every navigation), so it follows the
// session and the forms the scenario sent; webship-js's own "the response
// status code should be ..." reads the same.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  siteUrl,
  currentPath,
  settle,
  navigating,
  eventually,
  isHandle,
  resolveUser,
  documentStatus,
  hasToolbar,
  loadedToolbar,
  toolbarValue,
  toolbarBlocks,
} = require('./symfony-helpers');

/** What the page on screen says about itself: its status, title, main heading and text. */
async function pageSummary(world) {
  const status = await documentStatus(world);
  const title = clean(await world.page.title().catch(() => ''));
  const heading = clean(await world.page.locator('h1').filter({ visible: true }).first().innerText({ timeout: 500 }).catch(() => ''));
  const text = clean(await world.page.locator('body').innerText({ timeout: 1000 }).catch(() => ''));
  return { status, title, heading, text };
}

/**
 * Assert that the browser shows the error page of a status: the page answered
 * with that status, and it prints the code (the error pages of the app, or the
 * framework's own "Oops! An Error Occurred" page). The debug page of a
 * development app is no error page: see "the page should show debug
 * information".
 *
 * Example #1: Then I should see the 404 error page
 * Example #2: Then I should see the 403 error page
 * Example #3: And I should see the 405 error page
 * Example #4: Then we should see the 500 error page
 * Example #5: Then I should not see the 404 error page
 */
Then(/^(I |we )*should( not)* see the (\d{3}) error page$/, async function (pronounCase, notCase, code) {
  const wanted = Number(code);
  const deadline = Date.now() + budget(this);
  let summary;
  const showsIn = (s) => s.status === wanted && !s.debug && (s.heading.includes(code) || s.title.includes(code) || s.text.includes(code));
  for (;;) {
    summary = await pageSummary(this);
    // The debug page of a development app answers with the same status, but it is no error page.
    summary.debug = (await debugSigns(this)).some((sign) => /exception page/.test(sign));
    const shows = showsIn(summary);
    if (notCase ? !shows : shows) return;
    if (notCase || Date.now() > deadline) break;
    await this.page.waitForTimeout(200);
  }
  const what = `HTTP ${summary.status === null ? '(status unknown)' : summary.status}, "${summary.title}"${summary.heading ? `, heading "${summary.heading}"` : ''}`;
  if (notCase) {
    throw friendly({ message: `Expected not to see the ${code} error page, but the browser shows it (${what}) at ${currentPath(this)}.`, hint: 'The step reads the status the browser received for the page on screen.' });
  }
  throw friendly({
    message: `Expected the ${code} error page, but the browser shows ${what} at ${currentPath(this)}: "${summary.text.slice(0, 160)}".`,
    hint: summary.debug
      ? 'The app shows its debug page instead (APP_ENV=dev): a live app runs with APP_ENV=prod and APP_DEBUG=0.'
      : summary.status === wanted
        ? `The status is right, but the page does not print the code ${code}: an app with its own error pages should print it.`
        : 'The step reads the status the browser received for the page on screen (the one the last navigation, link or form brought).',
  });
});

/** The signs of debug information the page shows: what a live app must never print. */
async function debugSigns(world) {
  return world.page.evaluate(() => {
    const signs = [];
    if (document.querySelector('.exception-message-wrapper, .exception-message, .trace-details, .trace-line, .exception-summary')) signs.push('the exception page of the framework');
    if (document.querySelector('.sf-toolbar, [id^="sfwdt"]')) signs.push('the debug toolbar');
    const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
    const headings = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.textContent.replace(/\s+/g, ' ').trim());
    const exception = headings.find((h) => /\b[A-Z][A-Za-z]*(?:Exception|Error)\b/.test(h) && !/^(?:Error )?\d{3}\b/.test(h));
    if (exception) signs.push(`the exception class "${exception.slice(0, 80)}"`);
    if (/\b(?:Exception|Stack) trace\b/i.test(text)) signs.push('an exception trace');
    const file = text.match(/[\w./-]+\.php(?::\d+| line \d+)/);
    if (file) signs.push(`a source file "${file[0]}"`);
    if (/\b(?:Symfony|Doctrine|Twig)\\[A-Z]/.test(text)) signs.push('class names of the framework');
    return signs;
  }).catch(() => []);
}

/**
 * Assert that the page shows no debug information: no exception page, no
 * exception class or trace, no source file and line, no debug toolbar. A live
 * app answers an error with a plain error page; the debug page and the toolbar
 * show how the app is built to anybody.
 *
 * Example #1: Then the page should not show debug information
 * Example #2: And the page should not show debug information
 * Example #3: Then the page should show debug information
 * Example #4: But the page should not show debug information
 * Example #5: Then the page should show debug information
 */
Then(/^the page should( not)* show debug information$/, async function (notCase) {
  await settle(this);
  const signs = await debugSigns(this);
  if (notCase && signs.length) {
    throw friendly({
      message: `The page shows debug information: ${signs.join(', ')} (${currentPath(this)}).`,
      hint: 'A live app runs with APP_ENV=prod and APP_DEBUG=0: an error then renders the plain error page, and no toolbar is drawn. Check the environment of the app.',
    });
  }
  if (!notCase && !signs.length) {
    const summary = await pageSummary(this);
    throw friendly({
      message: `Expected the page to show debug information, but it shows none (HTTP ${summary.status}, "${summary.title}").`,
      hint: 'An app shows its debug page and its toolbar only in the dev environment (APP_ENV=dev, APP_DEBUG=1).',
    });
  }
});

/**
 * Send a form to an address of the app from a page of another site, as a
 * forged form on somebody else's page does: the browser posts it with a token
 * the app never gave, and says it comes from another site. The app must refuse
 * it: the login form answers "Invalid CSRF token.", a form of the app prints
 * that its token is invalid. Assert that with the next step.
 *
 * Example #1: When a page of another site sends a form to "/en/login"
 * Example #2: When a page of another site sends a form to "/en/profile/edit"
 * Example #3: And a page of another site sends a form to "/en/admin/post/new"
 * Example #4: When a page of another site sends a form to "/logout"
 * Example #5: When a page of another site sends a form to "/en/profile/change-password"
 */
When(/^a page of another site sends a form to "([^"]*)"$/, async function (path) {
  const action = siteUrl(this, path);
  const page = this.page;
  await page.goto('about:blank');
  const fields = { _username: 'nobody', _password: 'not-a-password', _csrf_token: 'a-token-of-another-site', _token: 'a-token-of-another-site', token: 'a-token-of-another-site' };
  const inputs = Object.entries(fields).map(([name, value]) => `<input type="hidden" name="${name}" value="${value}">`).join('');
  await page.setContent(`<!doctype html><title>Another site</title><form method="post" action="${action.replace(/"/g, '&quot;')}">${inputs}<button type="submit">Send</button></form>`);
  await navigating(this, () => page.locator('button[type="submit"]').click(), { label: `The form of the other site sent to ${action}`, hint: 'Check launchUrl in cucumber.js.' });
});

// ---------------------------------------------------------------------------
// The debug toolbar and the profiler (an app in the dev environment)
// ---------------------------------------------------------------------------

/**
 * Assert that the page shows the debug toolbar of a development app (and that
 * it finished loading its blocks), or that it shows none, as a live app must.
 *
 * Example #1: Then I should see the debug toolbar
 * Example #2: Then I should not see the debug toolbar
 * Example #3: And we should see the debug toolbar
 * Example #4: But I should not see the debug toolbar
 * Example #5: Then we should not see the debug toolbar
 */
Then(/^(I |we )*should( not)* see the debug toolbar$/, async function (pronounCase, notCase) {
  if (notCase) {
    await settle(this);
    if (await hasToolbar(this)) {
      throw friendly({ message: `Expected no debug toolbar, but the page carries one (${currentPath(this)}).`, hint: 'A live app runs with APP_ENV=prod: the toolbar is a tool of the dev environment.' });
    }
    return;
  }
  await loadedToolbar(this);
});

/**
 * Assert the status code the debug toolbar reports for the request of the
 * page.
 *
 * Example #1: Then the debug toolbar should show the status code 200
 * Example #2: Then the debug toolbar should show the status code 404
 * Example #3: And the debug toolbar should show the status code 403
 * Example #4: Then the debug toolbar should show the status code 422
 * Example #5: Then the debug toolbar should show the status code 200
 */
Then(/^the debug toolbar should show the status code (\d{3})$/, async function (code) {
  await loadedToolbar(this);
  const value = clean(await toolbarValue(this, 'request', 'HTTP status'));
  if (!value.startsWith(String(code))) {
    throw friendly({ message: `Expected the debug toolbar to show the status code ${code}, but it shows "${value || '(none)'}".`, hint: 'The request block of the toolbar reports the status of the request of the page.' });
  }
});

/**
 * Assert the name of the route the debug toolbar reports for the request of
 * the page.
 *
 * Example #1: Then the debug toolbar should show the route "blog_index"
 * Example #2: Then the debug toolbar should show the route "blog_post"
 * Example #3: And the debug toolbar should show the route "admin_post_index"
 * Example #4: Then the debug toolbar should show the route "security_login"
 * Example #5: Then the debug toolbar should show the route "user_edit"
 */
Then(/^the debug toolbar should show the route "([^"]*)"$/, async function (route) {
  await loadedToolbar(this);
  const value = clean(await toolbarValue(this, 'request', 'Route name'));
  if (value !== clean(route)) {
    throw friendly({ message: `Expected the debug toolbar to show the route "${route}", but it shows "${value || '(none)'}".`, hint: 'The request block of the toolbar names the route that matched the page.' });
  }
});

/**
 * Assert the account the debug toolbar reports as signed in (a handle of the
 * users registry stands for its username), or that nobody is.
 *
 * Example #1: Then the debug toolbar should show the account "administrator"
 * Example #2: Then the debug toolbar should show the account "user"
 * Example #3: And the debug toolbar should show the account "jane_admin"
 * Example #4: Then the debug toolbar should show no account
 * Example #5: But the debug toolbar should show no account
 */
Then(/^the debug toolbar should show (?:the account "([^"]*)"|no account)$/, async function (who) {
  await loadedToolbar(this);
  const value = clean(await toolbarValue(this, 'security', 'Logged in as'));
  const wanted = who ? (isHandle(this, who) ? (resolveUser(this, who).username || resolveUser(this, who).login) : who) : null;
  const signedIn = value && !/^(n\/a|anon\.?|none)$/i.test(value);
  if (wanted ? value !== wanted : signedIn) {
    throw friendly({
      message: wanted ? `Expected the debug toolbar to show the account "${wanted}", but it shows "${value || '(nobody)'}".` : `Expected the debug toolbar to show no account, but it shows "${value}".`,
      hint: 'The security block of the toolbar names the signed-in account (its username).',
    });
  }
});

/**
 * Assert how many errors the log of the request of the page holds, as the
 * debug toolbar counts them.
 *
 * Example #1: Then the debug toolbar should show 0 logged errors
 * Example #2: Then the debug toolbar should show 1 logged error
 * Example #3: And the debug toolbar should show 0 logged errors
 * Example #4: Then the debug toolbar should show 2 logged errors
 * Example #5: Then the debug toolbar should show 0 logged errors
 */
Then(/^the debug toolbar should show (\d+) logged errors?$/, async function (count) {
  await loadedToolbar(this);
  const value = clean(await toolbarValue(this, 'logger', 'Errors'));
  if (Number(value || 0) !== Number(count)) {
    throw friendly({ message: `Expected the debug toolbar to show ${count} logged error(s), but it shows ${value || 0}.`, hint: 'The logger block of the toolbar counts the errors the request logged; the profiler lists them (its "Logs" panel).' });
  }
});

/**
 * Assert that the request of the page ran no more database queries than a
 * limit, as the debug toolbar counts them: a list that runs one query per row
 * shows here first.
 *
 * Example #1: Then the debug toolbar should show at most 10 database queries
 * Example #2: Then the debug toolbar should show at most 5 database queries
 * Example #3: And the debug toolbar should show at most 1 database query
 * Example #4: Then the debug toolbar should show at most 20 database queries
 * Example #5: Then the debug toolbar should show at most 10 database queries
 */
Then(/^the debug toolbar should show at most (\d+) database quer(?:y|ies)$/, async function (limit) {
  await loadedToolbar(this);
  const value = clean(await toolbarValue(this, 'db', 'Database Queries'));
  if (!value) {
    throw friendly({ message: `The debug toolbar shows no database block. Its blocks: ${listed(await toolbarBlocks(this))}.`, hint: 'The database block is there when the app talks to a database through its ORM.' });
  }
  if (Number(value) > Number(limit)) {
    throw friendly({ message: `Expected at most ${limit} database queries, but the request of the page ran ${value}.`, hint: 'The database panel of the profiler lists each query of the request.' });
  }
});

/**
 * Open the profiler of the request of the page, as a person does: follow the
 * request block of the debug toolbar. The profiler shows the method and the
 * address of the request it profiled.
 *
 * Example #1: When I open the profiler of the page
 * Example #2: When we open the profiler of the page
 * Example #3: And I open the profiler of the page
 * Example #4: Given I open the profiler of the page
 * Example #5: Then I open the profiler of the page
 */
When(/^(I |we )*open the profiler of the page$/, async function (pronounCase) {
  const bar = await loadedToolbar(this);
  const link = bar.locator('.sf-toolbar-block-request a[href*="/_profiler/"]').first();
  const href = await link.getAttribute('href').catch(() => null);
  if (!href) {
    throw friendly({ message: 'The debug toolbar has no link to the profiler.', hint: 'The request block of the toolbar links to the profile of the request.' });
  }
  await navigating(this, () => this.page.goto(href.replace(/\?.*$/, ''), { waitUntil: 'domcontentloaded' }), { label: 'The profiler' });
});

/** The request the profiler shows: its method and address, its status. */
async function profiledRequest(world) {
  return world.page.evaluate(() => {
    const summary = document.querySelector('.status h2, #summary h2, h2');
    const status = [...document.querySelectorAll('dt')].find((dt) => /Response/i.test(dt.textContent));
    return {
      request: summary ? summary.textContent.replace(/\s+/g, ' ').trim() : '',
      status: status && status.nextElementSibling ? status.nextElementSibling.textContent.replace(/\s+/g, ' ').trim() : '',
    };
  }).catch(() => ({ request: '', status: '' }));
}

/**
 * Assert the request the profiler shows: its method and its path (the address
 * of the app the request was sent to), and its status.
 *
 * Example #1: Then the profiler should show the "GET" request to "/en/blog/"
 * Example #2: Then the profiler should show the "POST" request to "/en/login"
 * Example #3: And the profiler should show the "GET" request to "/en/blog/" with the status 200
 * Example #4: Then the profiler should show the "GET" request to "/en/no-such-page" with the status 404
 * Example #5: Then the profiler should show the "GET" request to "/en/admin/post/" with the status 403
 */
Then(/^the profiler should show the "([A-Z]+)" request to "([^"]*)"(?: with the status (\d{3}))?$/, async function (method, path, status) {
  const read = () => profiledRequest(this);
  await eventually(this, read, (seen) => {
    const m = seen.request.match(/^([A-Z]+)\s+(\S+)/);
    if (!m || m[1] !== method) return false;
    let url;
    try { url = new URL(m[2]); } catch { return false; }
    return url.pathname.replace(/\/+$/, '') === String(path).replace(/\/+$/, '') && (!status || seen.status.startsWith(String(status)));
  }, (seen) => ({
    message: `Expected the profiler to show the "${method}" request to "${path}"${status ? ` with the status ${status}` : ''}, but it shows "${seen.request || '(nothing)'}"${seen.status ? ` (response ${seen.status})` : ''} at ${this.page.url()}.`,
    hint: 'Open the profiler of the page first (I open the profiler of the page).',
  }));
});

/**
 * Open a panel of the profiler by the name its menu gives it.
 *
 * Example #1: When I open the "Logs" panel of the profiler
 * Example #2: When we open the "Performance" panel of the profiler
 * Example #3: And I open the "Routing" panel of the profiler
 * Example #4: When I open the "Security" panel of the profiler
 * Example #5: When I open the "Request / Response" panel of the profiler
 */
When(/^(I |we )*open the "([^"]*)" panel of the profiler$/, async function (pronounCase, panel) {
  const menu = this.page.locator('#menu-profiler, nav[aria-label="Profiler menu"], #sidebar').first();
  const link = menu.locator('a').filter({ has: this.page.locator('strong, .label', { hasText: new RegExp(`^\\s*${panel.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\s*$`) }) }).first();
  if (!(await link.count())) {
    const names = (await menu.locator('a strong, a .label').allInnerTexts().catch(() => [])).map(clean);
    throw friendly({ message: `The profiler has no "${panel}" panel. Its panels: ${listed(names)}.`, hint: 'Open the profiler of the page first, and name the panel as its menu writes it.' });
  }
  await navigating(this, () => link.click(), { label: `The "${panel}" panel of the profiler` });
  await eventually(this, () => this.page.locator('#collector-content h2, .content h2, main h2').first().innerText().catch(() => ''), (h) => !!clean(h), () => ({
    message: `The "${panel}" panel of the profiler did not open (${this.page.url()}).`,
    hint: 'A panel of the profiler opens with its own heading.',
  }));
});
