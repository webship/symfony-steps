'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the steps use and that a project can require for its own steps: the
// wait budget and the settle on the page's own requests, the users registry and
// the session cache, fields found by their label and the errors the form theme
// prints for them, the messages of a page (the flash messages and the alerts),
// the user menu, the navigation, the language chooser, the mailbox of the test
// app, the status of the page and the debug toolbar of a development app.
//
// The pages are rendered on the server: a form posts and the next page answers.
// Every lookup starts with what a person reads (a label, a role, a text) and
// falls back to what the framework itself prints the same way in every app:
// the field names of the login form (`_username`, `_password`), the ids and
// classes of the form themes (`<id>_error1`, `.invalid-feedback`,
// `.form-error-message`), `aria-describedby`, `aria-invalid`, `hreflang`.
//
// Everything builds on webship-js's own helpers (`gotoUrl`, `friendly`,
// `fillField`) so the steps fail the way the core webship-js steps do.

const { gotoUrl, friendly, fillField } = require('webship-js/tests/step-definitions/webship');

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds. Kept below webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** The settle budget after an action (`minWaitTime.page`, 3 seconds by default). */
function settleBudget(world) {
  return (world && world.minWaitTime && world.minWaitTime.page) || 3000;
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** White space collapsed and trimmed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** The site root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** Join the site root and a path with exactly one slash. Absolute URLs pass through. */
function siteUrl(world, url) {
  if (!url) return siteRoot(world) + '/';
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/** A path of the app read from cucumber.js (`worldParameters.<key>`), or its default. */
function appPath(world, key, fallback) {
  const value = world.parameters && world.parameters[key];
  return '/' + String(value || fallback).replace(/^\/+/, '');
}

/** The page an account is sent to after the login-by-handle step (`homePath`, /en/blog/ on the demo). */
function homePath(world) {
  return appPath(world, 'homePath', '/en/blog/');
}

/** The login page (`loginPath`, /en/login on the demo). */
function loginPath(world) {
  return appPath(world, 'loginPath', '/en/login');
}

/** A page only a signed-in account may open (`accountPath`, the profile of the demo: /en/profile/edit). */
function accountPath(world) {
  return appPath(world, 'accountPath', '/en/profile/edit');
}

/** The path of the page the browser shows, without the query and the fragment. */
function currentPath(world) {
  try {
    return new URL(world.page.url()).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

/** Whether the browser shows the page of a path (trailing slashes ignored). */
function isOnPath(world, path) {
  return currentPath(world) === (String(path).replace(/\/+$/, '') || '/');
}

// ---------------------------------------------------------------------------
// Waiting on the page's own requests
// ---------------------------------------------------------------------------

const TRACKED = new WeakMap();

/**
 * The background requests (XHR and fetch) of the page that are still running,
 * and how many started so far. The tracker is attached once per page.
 *
 * @returns {{pending: Set, started: number, answers: Array}}
 */
function requests(world) {
  const page = world.page;
  let state = TRACKED.get(page);
  if (!state) {
    state = { pending: new Set(), started: 0, answers: [] };
    TRACKED.set(page, state);
    const background = (request) => ['xhr', 'fetch'].includes(request.resourceType());
    page.on('request', (request) => {
      if (!background(request)) return;
      state.pending.add(request);
      state.started += 1;
    });
    page.on('response', (response) => {
      if (!background(response.request())) return;
      state.answers.push({ url: response.url(), method: response.request().method(), status: response.status(), at: Date.now() });
      if (state.answers.length > 50) state.answers.shift();
    });
    const done = (request) => { state.pending.delete(request); };
    page.on('requestfinished', done);
    page.on('requestfailed', done);
    // A navigation drops the requests of the page it leaves.
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) state.pending.clear(); });
  }
  return state;
}

/**
 * Wait for the page to go quiet after an action: the document is loaded and no
 * background request has been running for a moment. Returns as soon as that is
 * true, and at the latest after `timeout` (the settle budget by default).
 */
async function settle(world, timeout) {
  const state = requests(world);
  const deadline = Date.now() + (timeout || settleBudget(world));
  await world.page.waitForLoadState('domcontentloaded', { timeout: Math.max(deadline - Date.now(), 1) }).catch(() => {});
  let quietSince = 0;
  while (Date.now() < deadline) {
    if (state.pending.size === 0) {
      if (!quietSince) quietSince = Date.now();
      if (Date.now() - quietSince >= 300) return;
    } else {
      quietSince = 0;
    }
    await world.page.waitForTimeout(40);
  }
}

/** Open a URL and wait for the page to settle. */
async function open(world, url) {
  requests(world);
  await gotoUrl(world.page, url);
  await world.page.waitForSelector('body', { state: 'attached', timeout: budget(world) });
  await world.page.waitForLoadState('load', { timeout: budget(world) }).catch(() => {});
  await settle(world);
}

/**
 * Run an action that sends the browser to another page (a link, a form), and
 * wait for that page: the navigation it starts, then the page loaded and quiet.
 * Fails with a friendly error when no page comes within the budget.
 */
async function navigating(world, action, { label, hint } = {}) {
  const page = world.page;
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: budget(world) }),
      action(),
    ]);
  } catch (err) {
    throw friendly({ message: `${label || 'The action'} did not lead to another page (${page.url()}).`, cause: err, hint });
  }
  await page.waitForLoadState('load', { timeout: budget(world) }).catch(() => {});
  await settle(world);
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match
 * and fail with a friendly error otherwise: the wait and the assertion are one
 * call, so content that arrives a moment late still passes.
 */
async function assertPresence(locator, notCase, { label, hint, timeout, found }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    const seen = found ? await found().catch(() => '') : '';
    throw friendly({
      message: (notCase ? `Expected not to see ${label}, but it is on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`) + (seen ? ` ${seen}` : ''),
      hint,
    });
  }
}

/**
 * Poll a reading until it satisfies a check, or fail with the last reading.
 *
 * @param {object} world
 * @param {Function} read - async () => value
 * @param {Function} check - (value) => boolean
 * @param {Function} explain - (value) => {message, hint}
 */
async function eventually(world, read, check, explain, timeout) {
  const deadline = Date.now() + (timeout || budget(world));
  let value;
  for (;;) {
    value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) throw friendly(explain(value));
    await world.page.waitForTimeout(200);
  }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * An account of the users registry in cucumber.js (`worldParameters.users`),
 * by the handle a scenario names it with. The login identifier is its
 * `username`, else its `email`.
 *
 * @returns {{handle: string, login: string, username: (string|undefined), email: (string|undefined), password: string, name: (string|undefined)}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.${String(handle).toUpperCase()}_PASSWORD } }. The account itself is created once by the build of the app, never by a feature.`,
    });
  }
  const login = entry.username || entry.email;
  if (!login || !entry.password) {
    throw friendly({
      message: `The user "${handle}" has no ${login ? 'password' : 'username (or email)'} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.username and .password in cucumber.js, from environment variables.`,
    });
  }
  return { handle, login, username: entry.username, email: entry.email, password: entry.password, name: entry.name };
}

/** Whether a word is a handle of the users registry. */
function isHandle(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  return Object.prototype.hasOwnProperty.call(users, who);
}

/** A handle of the users registry stands for its address; anything else is an address. */
function addressOf(world, who) {
  if (!isHandle(world, who)) return who;
  const user = resolveUser(world, who);
  if (!user.email) {
    throw friendly({ message: `The user "${who}" has no email address in the users registry.`, hint: `Set worldParameters.users.${who}.email in cucumber.js.` });
  }
  return user.email;
}

/** A handle of the users registry stands for the name the app shows; anything else is a name. */
function nameOf(world, who) {
  if (!isHandle(world, who)) return who;
  const user = resolveUser(world, who);
  return user.name || user.username || user.login;
}

// The sessions of the accounts that logged in during this run, by site and
// login: the cookies of the browser after a login through the form. A scenario
// that logs in as an account that already has a session takes it over instead
// of filling in the login form again: quicker, and it keeps a suite under any
// limit the app puts on login attempts. `worldParameters.reuseSessions: false`
// in cucumber.js turns it off.
const SESSIONS = new Map();

function sessionKey(world, login) {
  return `${siteRoot(world)}|${String(login).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/**
 * The visible form control a person means by `name`: its label exactly as
 * written (a label element, also one only screen readers read,
 * `aria-labelledby` or `aria-label`), then its `name` attribute, then the one
 * label that starts with the text (letter case ignored), then its placeholder.
 * A control in an open dialog wins over one behind it.
 *
 * @returns {Promise<import('playwright').Locator>} one element
 */
async function findField(world, name, { timeout } = {}) {
  const page = world.page;
  const deadline = Date.now() + (timeout || budget(world));
  const candidates = () => [
    page.getByLabel(name, { exact: true }),
    page.locator(`[name="${String(name).replace(/["\\]/g, '\\$&')}"]`),
    page.getByLabel(new RegExp('^\\s*' + escapeRegExp(name), 'i')),
    page.getByPlaceholder(name, { exact: true }),
  ];
  for (;;) {
    for (const locator of candidates()) {
      const visible = [];
      const count = await locator.count().catch(() => 0);
      for (let i = 0; i < count; i += 1) {
        const item = locator.nth(i);
        if (await item.isVisible().catch(() => false)) visible.push(item);
      }
      if (visible.length === 1) return visible[0];
      if (visible.length > 1) {
        for (const item of visible) {
          if (await item.evaluate((el) => !!el.closest('dialog[open], [role="dialog"], .modal.show')).catch(() => false)) return item;
        }
        return visible[0];
      }
    }
    if (Date.now() > deadline) break;
    await page.waitForTimeout(150);
  }
  const labels = await visibleFieldLabels(world);
  throw friendly({
    message: `No field "${name}" is on the page (${world.page.url()}). The fields are: ${listed(labels)}.`,
    hint: 'Name the field by its label as the page writes it, or by its name attribute ("_username", "post[title]").',
  });
}

/** The labels of the visible form controls of the page, for an error message. */
async function visibleFieldLabels(world) {
  return world.page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      const box = el.getBoundingClientRect();
      if (!box.width && !box.height) continue;
      const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean);
      const text = by.length ? by.map((n) => n.textContent).join(' ') : ((el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || '');
      out.push(text.replace(/\s+/g, ' ').trim());
    }
    return out;
  }).catch(() => []);
}

// What the form themes print under (or above) a field that was refused:
// bootstrap_5_layout `div.invalid-feedback#<id>_error1` (named by the field's
// aria-describedby), bootstrap_4_layout `.form-error-message`, form_div_layout
// a list (`ul > li`) next to the widget, the tailwind and foundation layouts a
// red text line or `.error`.
const ERROR_LINES = '.invalid-feedback, .form-error-message, [id$="_error1"], [id$="_error2"], [id$="_error3"], [role="alert"], small.error, .error-message, p[class*="text-red"], li[class*="text-red"]';

/**
 * The error messages the page shows for a field: the elements its
 * `aria-describedby` names that are errors (ids ending in `_error<n>`, or an
 * error class), then the error lines inside the smallest container that holds
 * the field and no other field.
 *
 * @returns {Promise<string[]>}
 */
async function fieldErrors(field) {
  return field.evaluate((el, selector) => {
    const shown = (n) => {
      if (!n || !n.isConnected) return false;
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const box = n.getBoundingClientRect();
      return box.width > 0 || box.height > 0;
    };
    const text = (n) => (n.textContent || '').replace(/\s+/g, ' ').trim();
    const found = [];
    for (const id of (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)) {
      const node = document.getElementById(id);
      if (!node || !shown(node) || !text(node)) continue;
      if (/_error\d+$/.test(id) || node.matches(selector)) found.push(text(node));
    }
    let group = null;
    for (let node = el.parentElement, i = 0; node && i < 6; node = node.parentElement, i += 1) {
      if (node.tagName === 'FORM') break;
      const others = [...node.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((c) => c !== el && c.type !== 'hidden' && !c.classList.contains('tt-hint'));
      if (others.length) break;
      group = node;
    }
    if (group) {
      for (const line of group.querySelectorAll(selector)) {
        if (line === el || line.contains(el)) continue;
        if (shown(line) && text(line)) found.push(text(line));
      }
      // form_div_layout: the errors are a plain list next to the widget.
      for (const item of group.querySelectorAll(':scope > ul > li')) {
        if (shown(item) && text(item)) found.push(text(item));
      }
    }
    return [...new Set(found)];
  }, ERROR_LINES).catch(() => []);
}

/** Every field error shown on the page, for an error message. */
async function pageFieldErrors(world) {
  return world.page.evaluate((selector) => {
    const out = [];
    for (const n of document.querySelectorAll(selector)) {
      if (n.closest('.alert, [role="alert"]') && !n.matches('.invalid-feedback, .form-error-message')) continue;
      const box = n.getBoundingClientRect();
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && (box.width || box.height) && getComputedStyle(n).display !== 'none') out.push(t);
    }
    return [...new Set(out)];
  }, '.invalid-feedback, .form-error-message, [id$="_error1"]').catch(() => []);
}

/** Fill a field the way webship-js's "I fill in" does: by its exact label, placeholder or name. */
async function fillLikeABuiltIn(world, name, value) {
  await fillField(world.page, name, value, world);
}

// ---------------------------------------------------------------------------
// Messages: the flash messages and the alerts of a page
// ---------------------------------------------------------------------------

// The kind of a message by the class the page gives it: Bootstrap's alert-*,
// and the words other themes use (flash-*, notice, error).
const KINDS = [
  ['success', /\b(alert|flash|message|notification|toast)-success\b|\bsuccess\b/],
  ['error', /\b(alert|flash|message|notification|toast)-(danger|error)\b|\b(danger|error)\b/],
  ['warning', /\b(alert|flash|message|notification|toast)-warning\b|\bwarning\b/],
  ['info', /\b(alert|flash|message|notification|toast)-(info|notice|primary|secondary|light|dark)\b|\b(info|notice)\b/],
];

/**
 * The messages the page shows: alerts (`[role=alert]`, `[role=status]`,
 * `.alert`) and flash messages (`.flash`, `.flash-*`), visible, as
 * `{kind, text}`. A field error is not a message.
 */
async function pageMessages(world) {
  const list = await world.page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const n of document.querySelectorAll('[role="alert"], [role="status"], .alert, .flash, [class*="flash-"]')) {
      if (n.matches('.invalid-feedback, .form-error-message') || n.closest('.sf-toolbar, .invalid-feedback, [id^="sfwdt"]')) continue;
      if (seen.has(n) || [...seen].some((s) => s.contains(n))) continue;
      const style = getComputedStyle(n);
      const box = n.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || (!box.width && !box.height)) continue;
      const copy = n.cloneNode(true);
      copy.querySelectorAll('button, .btn-close, .close, [data-bs-dismiss], [data-dismiss]').forEach((b) => b.remove());
      const text = (copy.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      seen.add(n);
      out.push({ cls: String(n.className || ''), text });
    }
    return out;
  }).catch(() => []);
  return list.map((item) => {
    const kind = (KINDS.find(([, re]) => re.test(item.cls)) || [''])[0];
    return { kind, text: item.text };
  });
}

// ---------------------------------------------------------------------------
// The user menu and the navigation
// ---------------------------------------------------------------------------

/**
 * The button that opens the user menu: a dropdown toggle whose menu holds a
 * link to log out (in any language: its address names the logout route), else
 * a dropdown toggle of the header that names the account.
 *
 * @returns {Promise<import('playwright').Locator|null>}
 */
async function userMenuTrigger(world) {
  const page = world.page;
  const index = await page.evaluate(() => {
    const toggles = [...document.querySelectorAll('[data-bs-toggle="dropdown"], [data-toggle="dropdown"], [aria-haspopup="true"], [aria-haspopup="menu"]')];
    const visible = (el) => { const b = el.getBoundingClientRect(); return (b.width || b.height) && getComputedStyle(el).visibility !== 'hidden'; };
    for (let i = 0; i < toggles.length; i += 1) {
      const toggle = toggles[i];
      if (!visible(toggle) || toggle.closest('.sf-toolbar')) continue;
      const scope = toggle.closest('.dropdown, li, [data-controller]') || toggle.parentElement;
      const menu = scope && scope.querySelector('.dropdown-menu, [role="menu"]');
      if (menu && menu.querySelector('a[href*="logout"], form[action*="logout"]')) return i;
    }
    return -1;
  }).catch(() => -1);
  if (index < 0) return null;
  return page.locator('[data-bs-toggle="dropdown"], [data-toggle="dropdown"], [aria-haspopup="true"], [aria-haspopup="menu"]').nth(index);
}

/** The menu of a dropdown toggle. */
function menuOf(trigger) {
  return trigger.locator('xpath=ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " dropdown ") or self::li][1]').locator('.dropdown-menu, [role="menu"]').first();
}

/** Open the user menu and return it, or fail with a friendly error. */
async function openUserMenu(world) {
  const trigger = await userMenuTrigger(world);
  if (!trigger) {
    throw friendly({
      message: `This page has no user menu (${world.page.url()}): nobody is signed in, or it is a page without the app's header.`,
      hint: 'Log in first (I am a logged in user with the "..." user) and open a page of the app.',
    });
  }
  const menu = menuOf(trigger);
  if (!(await menu.isVisible().catch(() => false))) await trigger.click();
  try {
    await menu.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: 'The user menu did not open.', cause: err, hint: 'The user menu opens from the button with the name of the signed-in account, in the header.' });
  }
  return { trigger, menu };
}

/** The items of a menu: its links and buttons, by their text. */
async function menuItems(menu) {
  return (await menu.locator('a, button, [role="menuitem"]').allInnerTexts().catch(() => [])).map(clean).filter(Boolean);
}

/** Close a dropdown that is open (Escape). */
async function closeMenus(world) {
  if (await world.page.locator('.dropdown-menu.show').count().catch(() => 0)) await world.page.keyboard.press('Escape').catch(() => {});
}

/**
 * The items of the navigation landmarks of the page (the header's menu, any
 * `nav`): their text, their address and whether the page marks them as the
 * current one (`aria-current`, the `active` class).
 */
async function navigationItems(world) {
  return world.page.evaluate(() => {
    const items = [];
    for (const nav of document.querySelectorAll('nav, [role="navigation"]')) {
      if (nav.closest('.sf-toolbar') || nav.closest('.pagination') || nav.querySelector(':scope > ul.pagination, .pagination')) continue;
      for (const link of nav.querySelectorAll('a[href]')) {
        if (link.closest('.dropdown-menu, .pagination')) continue;
        const box = link.getBoundingClientRect();
        if (!box.width && !box.height) continue;
        const text = (link.innerText || link.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const marked = (node) => !!node && (
          (node.hasAttribute('aria-current') && node.getAttribute('aria-current') !== 'false')
          || (node.classList && node.classList.contains('active')));
        items.push({ text, href: link.href, current: marked(link) || marked(link.closest('li')) });
      }
    }
    const seen = new Set();
    return items.filter((item) => {
      const key = item.text + '|' + item.href;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }).catch(() => []);
}

// ---------------------------------------------------------------------------
// The language chooser
// ---------------------------------------------------------------------------

/**
 * The links of the language chooser: the links that say which language they
 * lead to (`hreflang`), as `{index, text, code, href, active, visible}`, with
 * the text the link shows (the language's own name, without the code the
 * chooser prints next to it).
 */
async function languageLinks(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('a[hreflang]')].map((a, index) => {
    const code = a.getAttribute('hreflang') || '';
    const copy = a.cloneNode(true);
    copy.querySelectorAll('small, .code, .locale-code').forEach((n) => { if ((n.textContent || '').trim() === code) n.remove(); });
    const text = (copy.textContent || '').replace(/\s+/g, ' ').trim();
    const box = a.getBoundingClientRect();
    const item = a.closest('li');
    const active = !!((item && item.classList.contains('active')) || a.classList.contains('active') || a.getAttribute('aria-current'));
    return { index, text, code, href: a.href, active, visible: !!(box.width || box.height) };
  })).catch(() => []);
}

/**
 * The control that opens the language chooser: the element that names the
 * container of the language links as its target (`data-bs-target`,
 * `aria-controls`, `href="#…"`), or the toggle of the dropdown that holds them.
 *
 * @returns {Promise<import('playwright').Locator|null>}
 */
async function languageChooserTrigger(world) {
  const id = await world.page.evaluate(() => {
    const link = document.querySelector('a[hreflang]');
    if (!link) return null;
    for (let node = link.parentElement; node && node !== document.body; node = node.parentElement) {
      if (node.id) {
        const sel = `[data-bs-target="#${node.id}"], [data-target="#${node.id}"], [aria-controls="${node.id}"], a[href="#${node.id}"]`;
        const trigger = [...document.querySelectorAll(sel)].find((t) => !node.contains(t));
        if (trigger) {
          trigger.setAttribute('data-webship-language-trigger', '1');
          return 'marked';
        }
      }
      if (node.classList.contains('dropdown-menu')) {
        const toggle = node.parentElement && node.parentElement.querySelector('[data-bs-toggle="dropdown"], [data-toggle="dropdown"]');
        if (toggle) {
          toggle.setAttribute('data-webship-language-trigger', '1');
          return 'marked';
        }
      }
    }
    return null;
  }).catch(() => null);
  if (!id) return null;
  return world.page.locator('[data-webship-language-trigger="1"]').first();
}

/**
 * The language of the page (`<html lang>`) and the direction its text runs in,
 * as a person sees it: the computed direction of the body (a page may turn it
 * with a class of its own), with the direction `<html dir>` declares beside it.
 */
async function pageLanguage(world) {
  return world.page.evaluate(() => ({
    lang: document.documentElement.getAttribute('lang') || '',
    dir: (getComputedStyle(document.body || document.documentElement).direction || 'ltr').toLowerCase(),
    declared: (document.documentElement.getAttribute('dir') || '').toLowerCase(),
  })).catch(() => ({ lang: '', dir: '', declared: '' }));
}

// ---------------------------------------------------------------------------
// The mailbox of the test app
// ---------------------------------------------------------------------------

/**
 * The address of the mailbox that catches the mail of the app
 * (`worldParameters.mailUrl` in cucumber.js): a Mailpit, which every DDEV
 * project has at port 8026.
 */
function mailUrl(world) {
  const url = world.parameters && world.parameters.mailUrl;
  if (!url) {
    throw friendly({ message: 'No mailbox is configured.', hint: 'Set worldParameters.mailUrl in cucumber.js to the Mailpit of the app, for example https://your-app.ddev.site:8026.' });
  }
  return String(url).replace(/\/+$/, '');
}

/** The messages of the mailbox to an address, newest first, as Mailpit lists them. */
async function mailList(world, address) {
  const request = world.page.context().request;
  const response = await request.get(`${mailUrl(world)}/api/v1/search?query=${encodeURIComponent('to:' + address)}`, { failOnStatusCode: false, ignoreHTTPSErrors: true });
  if (!response.ok()) throw new Error(`the mailbox answered HTTP ${response.status()}`);
  return (await response.json()).messages || [];
}

/**
 * The newest e-mail to an address that arrived after a moment in time, once it
 * is there (and, when `subject` is given, with that subject).
 *
 * @returns {Promise<{id: string, subject: string, text: string, html: string}>}
 */
async function mailTo(world, address, { since = 0, subject = null, timeout } = {}) {
  const request = world.page.context().request;
  const base = mailUrl(world);
  const deadline = Date.now() + (timeout || budget(world) * 2);
  let found = null;
  let problem = '';
  let subjects = [];
  for (;;) {
    try {
      const messages = (await mailList(world, address)).filter((message) => !since || Date.parse(message.Created) >= since - 2000);
      subjects = messages.map((message) => message.Subject);
      found = messages.find((message) => !subject || clean(message.Subject) === clean(subject)) || null;
      problem = messages.length ? `it has ${messages.length} for that address since the scenario began, none with the subject "${subject}"` : 'it has none for that address since the scenario began';
      if (found) break;
    } catch (err) {
      problem = clean(err && err.message).split(' Call log')[0];
    }
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(300);
  }
  if (!found) {
    throw friendly({
      message: `No e-mail${subject ? ` "${subject}"` : ''} to ${address} arrived in the mailbox at ${base} (${problem}).${subjects.length ? ` Subjects: ${listed(subjects)}.` : ''}`,
      hint: 'The app must send its mail to this mailbox (MAILER_DSN of the mail catcher; a DDEV project writes it into .env.local), and the address must be the one of the account. Check worldParameters.mailUrl in cucumber.js.',
    });
  }
  const message = await (await request.get(`${base}/api/v1/message/${found.ID}`, { ignoreHTTPSErrors: true })).json();
  return { id: found.ID, subject: message.Subject || '', text: message.Text || '', html: message.HTML || '' };
}

/**
 * The address of a link of an e-mail, by the text a person clicks (the text of
 * a link of the HTML version, or the label before the address in the text
 * version: "Reset password: https://…").
 */
function mailLink(mail, label) {
  const anchors = [...String(mail.html).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: m[1].replace(/&amp;/g, '&'), text: clean(m[2].replace(/<[^>]+>/g, ' ')) }));
  const byText = anchors.find((a) => a.text.toLowerCase() === clean(label).toLowerCase());
  if (byText) return { href: byText.href, anchors };
  const line = String(mail.text).split('\n').map((l) => l.trim()).find((l) => l.toLowerCase().startsWith(clean(label).toLowerCase() + ':'));
  const inLine = line && line.match(/https?:\/\/\S+/);
  return { href: inLine ? inLine[0].replace(/[)\].,]+$/, '') : null, anchors };
}

/** The moment the scenario began, for the mail steps: only mail sent since then counts. */
function scenarioStart(world) {
  if (!world.__scenarioStartedAt) world.__scenarioStartedAt = Date.now();
  return world.__scenarioStartedAt;
}

// ---------------------------------------------------------------------------
// The status of the page
// ---------------------------------------------------------------------------

/**
 * The status of the document the browser shows: the one webship-js recorded
 * for the last navigation of the page (`_lastResponse`), else the one the
 * browser keeps in its navigation timing.
 */
async function documentStatus(world) {
  const last = world._lastResponse;
  const strip = (url) => String(url || '').split('#')[0];
  if (last && last.page === world.page && strip(last.url) === strip(world.page.url())) return last.status;
  return world.page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0];
    return entry && typeof entry.responseStatus === 'number' && entry.responseStatus ? entry.responseStatus : null;
  }).catch(() => null);
}

// ---------------------------------------------------------------------------
// The debug toolbar of a development app
// ---------------------------------------------------------------------------

// The toolbar is drawn at the foot of every HTML page of an app in debug mode:
// a placeholder (`#sfwdt<token>`) that loads the toolbar of that request in the
// background, then blocks (`.sf-toolbar-block-<name>`) whose details are
// `<b>label</b> <span>value</span>` pieces.
const TOOLBAR = '.sf-toolbar, [role="toolbar"][aria-label$="Debug Toolbar"]';

/** Whether the page carries a debug toolbar, or its placeholder. */
async function hasToolbar(world) {
  return world.page.evaluate(() => !!document.querySelector('.sf-toolbar, [id^="sfwdt"], [role="toolbar"][aria-label$="Debug Toolbar"]')).catch(() => false);
}

/** Wait for the toolbar to finish loading, or fail: it shows its blocks once its own request answered. */
async function loadedToolbar(world) {
  const page = world.page;
  try {
    await page.waitForFunction(() => {
      const bar = document.querySelector('.sf-toolbar');
      return !!bar && bar.querySelectorAll('.sf-toolbar-block').length > 0 && !/Loading…/.test(bar.textContent || '');
    }, null, { timeout: budget(world) });
  } catch (err) {
    const present = await hasToolbar(world);
    throw friendly({
      message: present
        ? `The debug toolbar of this page did not finish loading (${page.url()}).`
        : `This page has no debug toolbar (${page.url()}).`,
      cause: present ? err : undefined,
      hint: present
        ? 'The toolbar loads its blocks with a request of its own (/_wdt/<token>): check that the profiler routes answer.'
        : 'The toolbar is drawn in the dev environment with the profiler on (APP_ENV=dev, APP_DEBUG=1, the web profiler bundle installed), on HTML pages that have a closing </body>.',
    });
  }
  return page.locator('.sf-toolbar').first();
}

/** The value of a piece of a toolbar block, by its label ("Route name", "Errors"), as the toolbar prints it. */
async function toolbarValue(world, block, label) {
  return world.page.evaluate(({ block, label }) => {
    const node = document.querySelector(`.sf-toolbar .sf-toolbar-block-${block}`);
    if (!node) return null;
    for (const piece of node.querySelectorAll('.sf-toolbar-info-piece')) {
      const b = piece.querySelector('b');
      if (b && b.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === label.toLowerCase()) {
        const copy = piece.cloneNode(true);
        copy.querySelector('b').remove();
        return copy.textContent.replace(/\s+/g, ' ').trim();
      }
    }
    return null;
  }, { block, label }).catch(() => null);
}

/** The labels of the blocks of the toolbar, for an error message. */
async function toolbarBlocks(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('.sf-toolbar .sf-toolbar-block')]
    .map((b) => (b.getAttribute('data-accessible-label') || (b.className.match(/sf-toolbar-block-([\w-]+)/) || [])[1] || '').trim())
    .filter(Boolean)).catch(() => []);
}

module.exports = {
  budget,
  settleBudget,
  escapeRegExp,
  clean,
  listed,
  siteRoot,
  siteUrl,
  appPath,
  homePath,
  loginPath,
  accountPath,
  currentPath,
  isOnPath,
  requests,
  settle,
  open,
  navigating,
  assertPresence,
  eventually,
  resolveUser,
  isHandle,
  addressOf,
  nameOf,
  SESSIONS,
  sessionKey,
  reuseSessions,
  findField,
  visibleFieldLabels,
  fieldErrors,
  pageFieldErrors,
  fillLikeABuiltIn,
  pageMessages,
  userMenuTrigger,
  menuOf,
  openUserMenu,
  menuItems,
  closeMenus,
  navigationItems,
  languageLinks,
  languageChooserTrigger,
  pageLanguage,
  mailUrl,
  mailList,
  mailTo,
  mailLink,
  scenarioStart,
  documentStatus,
  TOOLBAR,
  hasToolbar,
  loadedToolbar,
  toolbarValue,
  toolbarBlocks,
};
