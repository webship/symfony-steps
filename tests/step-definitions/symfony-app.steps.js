'use strict';

// The frame of the app: the user menu of the header (open an item, what it
// offers, the account it names), the navigation (its items, the current page)
// and the language chooser (choose a language, what it offers, the current
// one, the direction the page is written in).
//
// The user menu is the dropdown of the header that holds the logout link, so
// it is found in every language. The language chooser is the set of links
// that say which language they lead to (`hreflang`), wherever the page keeps
// them: in a dialog, in a dropdown, or in the open.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  currentPath,
  settle,
  navigating,
  eventually,
  nameOf,
  openUserMenu,
  menuItems,
  closeMenus,
  navigationItems,
  languageLinks,
  languageChooserTrigger,
  pageLanguage,
} = require('./symfony-helpers');

/**
 * Open an item of the user menu of the header, by its text, as a person does:
 * open the menu, then follow the item.
 *
 * Example #1: When I open "Account" from the user menu
 * Example #2: When we open "Account" from the user menu
 * Example #3: And I open "Logout" from the user menu
 * Example #4: When I open "Cuenta" from the user menu
 * Example #5: Given I open "Account" from the user menu
 */
When(/^(I |we )*open "([^"]*)" from the user menu$/, async function (pronounCase, item) {
  const { menu } = await openUserMenu(this);
  const entry = menu.locator('a, button').filter({ hasText: new RegExp(`^\\s*${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first();
  if (!(await entry.count())) {
    const offered = await menuItems(menu);
    await closeMenus(this);
    throw friendly({ message: `The user menu has no item "${item}". It offers: ${listed(offered)}.`, hint: 'Name the item as the menu writes it.' });
  }
  await navigating(this, () => entry.click(), { label: `The "${item}" item of the user menu` });
});

/**
 * Assert that the user menu offers, or does not offer, an item.
 *
 * Example #1: Then the user menu should offer "Account"
 * Example #2: Then the user menu should offer "Logout"
 * Example #3: And the user menu should not offer "Backend"
 * Example #4: Then the user menu should offer "Cuenta"
 * Example #5: But the user menu should not offer "Settings"
 */
Then(/^the user menu should( not)* offer "([^"]*)"$/, async function (notCase, item) {
  const { menu } = await openUserMenu(this);
  const offered = await menuItems(menu);
  await closeMenus(this);
  const has = offered.some((text) => text === clean(item));
  if (has === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the user menu not to offer "${item}", but it does.` : `Expected the user menu to offer "${item}". It offers: ${listed(offered)}.`,
      hint: 'The step opens the user menu of the header and reads its items.',
    });
  }
});

/**
 * Assert the account the user menu names: the button that opens it carries
 * the name of the signed-in account (a handle of the users registry stands
 * for its name).
 *
 * Example #1: Then the user menu should name "administrator"
 * Example #2: Then the user menu should name "user"
 * Example #3: And the user menu should name "Jane Doe"
 * Example #4: Then the user menu should name "John Doe"
 * Example #5: And the user menu should name "administrator"
 */
Then(/^the user menu should name "([^"]*)"$/, async function (who) {
  const name = nameOf(this, who);
  const { trigger } = await openUserMenu(this);
  const shown = clean(await trigger.innerText().catch(() => ''));
  await closeMenus(this);
  if (shown !== clean(name)) {
    throw friendly({ message: `Expected the user menu to name "${name}", but it names "${shown}".`, hint: 'The button of the user menu shows the name of the signed-in account.' });
  }
});

/**
 * Assert that the navigation of the page has, or does not have, an item: a
 * link of a navigation landmark (the menu of the header), by its text.
 *
 * Example #1: Then the navigation should have the item "Search"
 * Example #2: Then the navigation should have the item "Backend"
 * Example #3: And the navigation should not have the item "Backend"
 * Example #4: Then the navigation should have the item "Post list"
 * Example #5: Then the navigation should have the item "Back to blog"
 */
Then(/^the navigation should( not)* have the item "([^"]*)"$/, async function (notCase, item) {
  const items = await navigationItems(this);
  const has = items.some((entry) => entry.text === clean(item));
  if (has === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the navigation not to have the item "${item}", but it does.` : `Expected the navigation to have the item "${item}". It has: ${listed(items.map((i) => i.text))}.`,
      hint: 'The step reads the links of the navigation landmarks of the page.',
    });
  }
});

/**
 * Assert which item of the navigation the page marks as the current one
 * (`aria-current`, or the `active` class the menu of the header uses).
 *
 * Example #1: Then the navigation should show "Homepage" as the current page
 * Example #2: Then the navigation should show "Search" as the current page
 * Example #3: And the navigation should show "Post list" as the current page
 * Example #4: Then the navigation should not show "Search" as the current page
 * Example #5: Then the navigation should show "Buscar" as the current page
 */
Then(/^the navigation should( not)* show "([^"]*)" as the current page$/, async function (notCase, item) {
  const items = await navigationItems(this);
  const entry = items.find((i) => i.text === clean(item));
  if (!entry) {
    throw friendly({ message: `The navigation has no item "${item}". It has: ${listed(items.map((i) => i.text))}.`, hint: 'Name the item as the navigation writes it.' });
  }
  if (entry.current === !!notCase) {
    const current = items.filter((i) => i.current).map((i) => i.text);
    throw friendly({
      message: notCase ? `Expected the navigation not to show "${item}" as the current page, but it does.` : `Expected the navigation to show "${item}" as the current page. It shows ${listed(current)} (${currentPath(this)}).`,
      hint: 'The current item carries aria-current or the active class.',
    });
  }
});

/** The language links, opened when the chooser keeps them closed. */
async function openLanguageChooser(world) {
  const links = await languageLinks(world);
  if (!links.length) {
    throw friendly({ message: `This page has no language chooser (${world.page.url()}): no link says which language it leads to (hreflang).`, hint: 'A language chooser is a set of links with an hreflang attribute.' });
  }
  if (links.some((l) => l.visible)) return links;
  const trigger = await languageChooserTrigger(world);
  if (!trigger) {
    throw friendly({ message: 'The language links of this page are hidden, and nothing on the page opens them.', hint: 'The control that opens the chooser names its container (data-bs-target, aria-controls or href="#…").' });
  }
  await trigger.click();
  await eventually(world, () => languageLinks(world), (list) => list.some((l) => l.visible), () => ({
    message: 'The language chooser did not open.',
    hint: 'The control that opens it shows the dialog or the menu of the language links.',
  }));
  return languageLinks(world);
}

/**
 * Choose a language in the language chooser, by the name it shows (the
 * language's own name, "Español") or its code ("es"), as a person does: open
 * the chooser, follow the link. The page comes back in that language.
 *
 * Example #1: When I choose the language "Español"
 * Example #2: When we choose the language "Deutsch"
 * Example #3: And I choose the language "English"
 * Example #4: When I choose the language "العربية"
 * Example #5: When I choose the language "fr"
 */
When(/^(I |we )*choose the language "([^"]*)"$/, async function (pronounCase, language) {
  const links = await openLanguageChooser(this);
  const link = links.find((l) => l.visible && (l.text === clean(language) || l.code === language));
  if (!link) {
    throw friendly({ message: `The language chooser offers no "${language}". It offers: ${listed(links.map((l) => `${l.text} (${l.code})`))}.`, hint: 'Name the language as the chooser writes it, or by its code.' });
  }
  await navigating(this, () => this.page.locator('a[hreflang]').nth(link.index).click(), { label: `The language "${language}"` });
  await eventually(this, () => pageLanguage(this), (seen) => seen.lang.toLowerCase().replace('_', '-').startsWith(link.code.toLowerCase().replace('_', '-').split('-')[0]), (seen) => ({
    message: `After choosing "${language}" the page says its language is "${seen.lang}", not "${link.code}".`,
    hint: 'The page writes its language in <html lang>.',
  }));
});

/**
 * Assert that the language chooser offers, or does not offer, a language, by
 * the name it shows or its code.
 *
 * Example #1: Then the language chooser should offer "Deutsch"
 * Example #2: Then the language chooser should offer "Español"
 * Example #3: And the language chooser should offer "ja"
 * Example #4: Then the language chooser should not offer "Klingon"
 * Example #5: And the language chooser should offer "العربية"
 */
Then(/^the language chooser should( not)* offer "([^"]*)"$/, async function (notCase, language) {
  const links = await languageLinks(this);
  if (!links.length) {
    throw friendly({ message: `This page has no language chooser (${this.page.url()}).`, hint: 'A language chooser is a set of links with an hreflang attribute.' });
  }
  const has = links.some((l) => l.text === clean(language) || l.code === language);
  if (has === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the language chooser not to offer "${language}", but it does.` : `Expected the language chooser to offer "${language}". It offers: ${listed(links.map((l) => `${l.text} (${l.code})`))}.`,
      hint: 'Name the language as the chooser writes it, or by its code.',
    });
  }
});

/**
 * Assert the language the chooser marks as the current one, and that the
 * page is in it (`<html lang>`).
 *
 * Example #1: Then the current language should be "English"
 * Example #2: Then the current language should be "Español"
 * Example #3: And the current language should be "de"
 * Example #4: Then the current language should be "Français"
 * Example #5: And the current language should be "العربية"
 */
Then(/^the current language should be "([^"]*)"$/, async function (language) {
  await settle(this);
  const links = await languageLinks(this);
  const active = links.filter((l) => l.active);
  const wanted = links.find((l) => l.text === clean(language) || l.code === language);
  const { lang } = await pageLanguage(this);
  if (!wanted || !active.includes(wanted) || !lang.toLowerCase().replace('_', '-').startsWith(wanted.code.toLowerCase().replace('_', '-').split('-')[0])) {
    throw friendly({
      message: `Expected the current language to be "${language}". The chooser marks ${listed(active.map((l) => `${l.text} (${l.code})`))} and the page says its language is "${lang}".`,
      hint: 'The chooser marks the current language (an active item), and the page writes it in <html lang>.',
    });
  }
});

/**
 * Assert the direction the text of the page runs in, as a person sees it:
 * right to left for Arabic and Hebrew, left to right for the others (the
 * computed direction of the body).
 *
 * Example #1: Then the page should be written from right to left
 * Example #2: Then the page should be written from left to right
 * Example #3: And the page should be written from right to left
 * Example #4: But the page should be written from left to right
 * Example #5: Then the page should be written from left to right
 */
Then(/^the page should be written from (right to left|left to right)$/, async function (direction) {
  const wanted = direction === 'right to left' ? 'rtl' : 'ltr';
  await eventually(this, () => pageLanguage(this), (seen) => seen.dir === wanted, (seen) => ({
    message: `Expected the page to be written from ${direction}, but its text runs ${seen.dir} (language "${seen.lang}"${seen.declared ? `, <html dir="${seen.declared}">` : ''}).`,
    hint: 'The direction is the one of the body of the page: <html dir> or <body dir>, or a style of the page (direction: rtl).',
  }), budget(this));
});
