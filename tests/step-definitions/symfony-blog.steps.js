'use strict';

// The blog of the demo, as a reader and a writer see it: the posts of a list
// (each an `article` with its title as a heading link, its author and its
// tags), a post opened by its title, the tags that filter the list, the pager
// of a long list, the comments of a post and the comment form, and a field
// that updates the page while a person types in it (the search of the demo).
//
// A field that updates the page in place sits in a component that re-renders
// itself on the server: the component marks itself busy while its request
// runs and carries the value it was rendered with. The typing step waits on
// both, never on a fixed time.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  escapeRegExp,
  settle,
  navigating,
  eventually,
  nameOf,
  findField,
} = require('./symfony-helpers');

/** The posts the page lists: its `article` elements, with their title, author line and tags. */
async function listedPosts(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('article')].filter((a) => {
    const box = a.getBoundingClientRect();
    return box.width || box.height;
  }).map((a) => {
    const heading = a.querySelector('h1, h2, h3, h4');
    const meta = a.querySelector('.post-metadata, .metadata, header, footer');
    const tags = [...a.querySelectorAll('.post-tags a, a.badge, a[rel~="tag"], a[href*="tag="]')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return {
      title: heading ? heading.textContent.replace(/\s+/g, ' ').trim() : '',
      meta: meta ? meta.textContent.replace(/\s+/g, ' ').trim() : '',
      tags: [...new Set(tags)],
    };
  })).catch(() => []);
}

/** The post a scenario names: a listed article by its title, or the post the page shows (its h1). */
async function postByTitle(world, title) {
  const posts = await listedPosts(world);
  const listedPost = posts.find((p) => p.title === clean(title));
  if (listedPost) return listedPost;
  const single = await world.page.evaluate(() => {
    // The first heading a person sees: a dialog kept in the page (the language chooser) has one too.
    const h1 = [...document.querySelectorAll('h1')].find((h) => { const b = h.getBoundingClientRect(); return b.width || b.height; });
    if (!h1) return null;
    const scope = h1.parentElement;
    const meta = scope.querySelector('.post-metadata, .metadata');
    const tags = [...scope.querySelectorAll('.post-tags a, a.badge, a[rel~="tag"], a[href*="tag="]')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { title: h1.textContent.replace(/\s+/g, ' ').trim(), meta: meta ? meta.textContent.replace(/\s+/g, ' ').trim() : '', tags: [...new Set(tags)] };
  }).catch(() => null);
  if (single && single.title === clean(title)) return single;
  throw friendly({
    message: `No post "${title}" is on the page (${world.page.url()}). The posts: ${listed(posts.map((p) => p.title))}.`,
    hint: 'A post of a list is an article with its title as a heading; the page of a post has its title as the h1.',
  });
}

/**
 * Assert how many posts the page lists (its articles).
 *
 * Example #1: Then the page should list 10 posts
 * Example #2: Then the page should list 3 posts
 * Example #3: And the page should list 1 post
 * Example #4: Then the page should list 0 posts
 * Example #5: Then the page should list 10 posts
 */
Then(/^the page should list (\d+) posts?$/, async function (count) {
  await eventually(this, () => listedPosts(this), (posts) => posts.length === Number(count), (posts) => ({
    message: `Expected the page to list ${count} post(s), but it lists ${posts.length}: ${listed(posts.map((p) => p.title))}.`,
    hint: 'A post of a list is an article element of the page.',
  }));
});

/**
 * Assert that the page lists, or does not list, a post, by its title.
 *
 * Example #1: Then I should see the post "Pellentesque vitae velit ex"
 * Example #2: Then I should not see the post "Lorem ipsum dolor sit amet consectetur adipiscing elit"
 * Example #3: And we should see the post "Ut suscipit posuere justo at vulputate"
 * Example #4: Then I should see the post "Mauris dapibus risus quis suscipit vulputate"
 * Example #5: But I should not see the post "A post of the webship-js suite"
 */
Then(/^(I |we )*should( not)* see the post "([^"]*)"$/, async function (pronounCase, notCase, title) {
  if (notCase) await settle(this);
  await eventually(this, () => listedPosts(this), (posts) => posts.some((p) => p.title === clean(title)) !== !!notCase, (posts) => ({
    message: notCase ? `Expected not to see the post "${title}", but the page lists it.` : `Expected to see the post "${title}". The page lists: ${listed(posts.map((p) => p.title))}.`,
    hint: 'The step reads the titles of the articles of the page.',
  }), notCase ? 1 : undefined);
});

/**
 * Open a post of the list by its title, as a person does: follow the link of
 * its heading. The page of the post shows its title as its main heading.
 *
 * Example #1: When I open the post "Pellentesque vitae velit ex"
 * Example #2: When we open the post "Lorem ipsum dolor sit amet consectetur adipiscing elit"
 * Example #3: And I open the post "Mauris dapibus risus quis suscipit vulputate"
 * Example #4: When I open the post "A post of the webship-js suite"
 * Example #5: Given I open the post "Eros diam egestas libero eu vulputate risus"
 */
When(/^(I |we )*open the post "([^"]*)"$/, async function (pronounCase, title) {
  await postByTitle(this, title);
  const link = this.page.locator('article :is(h1, h2, h3, h4) a').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(title)}\\s*$`) }).first();
  await navigating(this, () => link.click(), { label: `The post "${title}"` });
  await eventually(this, () => this.page.locator('h1').filter({ visible: true }).first().innerText({ timeout: 1000 }).catch(() => ''), (h1) => clean(h1) === clean(title), (h1) => ({
    message: `The page of the post "${title}" did not open: the page is ${this.page.url()} with the heading "${clean(h1)}".`,
    hint: 'The link of a post leads to its own page.',
  }));
});

/**
 * Assert who wrote a post: its author line names the person (a handle of the
 * users registry stands for its name). On the page of the post, or for a post
 * of a list.
 *
 * Example #1: Then the post "Lorem ipsum dolor sit amet consectetur adipiscing elit" should be written by "Jane Doe"
 * Example #2: Then the post "A post of the webship-js suite" should be written by "administrator"
 * Example #3: And the post "Lorem ipsum dolor sit amet consectetur adipiscing elit" should not be written by "John Doe"
 * Example #4: Then the post "A post of the webship-js suite" should be written by "Jane Doe"
 * Example #5: And the post "Pellentesque vitae velit ex" should not be written by "user"
 */
Then(/^the post "([^"]*)" should( not)* be written by "([^"]*)"$/, async function (title, notCase, who) {
  const name = nameOf(this, who);
  const post = await postByTitle(this, title);
  const by = new RegExp(`(^|\\s)${escapeRegExp(name)}(\\s|$)`).test(post.meta);
  if (by === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the post "${title}" not to be written by "${name}", but its author line says "${post.meta}".` : `Expected the post "${title}" to be written by "${name}", but its author line says "${post.meta}".`,
      hint: 'The step reads the line under the title of the post (its date and its author).',
    });
  }
});

/**
 * Assert that a post carries, or does not carry, a tag.
 *
 * Example #1: Then the post "A post of the webship-js suite" should have the tag "lorem"
 * Example #2: Then the post "A post of the webship-js suite" should not have the tag "ipsum"
 * Example #3: And the post "Lorem ipsum dolor sit amet consectetur adipiscing elit" should have the tag "lorem"
 * Example #4: Then the post "A post of the webship-js suite" should have the tag "dolore"
 * Example #5: But the post "A post of the webship-js suite" should not have the tag "pariatur"
 */
Then(/^the post "([^"]*)" should( not)* have the tag "([^"]*)"$/, async function (title, notCase, tag) {
  const post = await postByTitle(this, title);
  if (post.tags.includes(clean(tag)) === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the post "${title}" not to have the tag "${tag}", but it has.` : `Expected the post "${title}" to have the tag "${tag}". Its tags: ${listed(post.tags)}.`,
      hint: 'The tags of a post are the links under it.',
    });
  }
});

/**
 * Filter the list by a tag, as a person does: follow the link of that tag
 * under a post. The list then shows only the posts with that tag.
 *
 * Example #1: When I filter the posts by the tag "lorem"
 * Example #2: When we filter the posts by the tag "ipsum"
 * Example #3: And I filter the posts by the tag "dolore"
 * Example #4: When I filter the posts by the tag "labore"
 * Example #5: Given I filter the posts by the tag "pariatur"
 */
When(/^(I |we )*filter the posts by the tag "([^"]*)"$/, async function (pronounCase, tag) {
  const link = this.page.locator('article :is(.post-tags a, a.badge, a[rel~="tag"], a[href*="tag="])').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(tag)}\\s*$`) }).filter({ visible: true }).first();
  if (!(await link.count())) {
    const tags = [...new Set((await listedPosts(this)).flatMap((p) => p.tags))];
    throw friendly({ message: `No post of this page has the tag "${tag}". The tags on the page: ${listed(tags)}.`, hint: 'Filter by a tag one of the listed posts carries.' });
  }
  await navigating(this, () => link.click(), { label: `The tag "${tag}"` });
});

/**
 * Assert that every post the page lists has a tag (and that it lists one at
 * least): what a list filtered by that tag shows.
 *
 * Example #1: Then every post should have the tag "lorem"
 * Example #2: Then every post should have the tag "ipsum"
 * Example #3: And every post should have the tag "dolore"
 * Example #4: Then every post should have the tag "labore"
 * Example #5: Then every post should have the tag "pariatur"
 */
Then(/^every post should have the tag "([^"]*)"$/, async function (tag) {
  const posts = await listedPosts(this);
  if (!posts.length) {
    throw friendly({ message: `Expected every post to have the tag "${tag}", but the page lists no post (${this.page.url()}).`, hint: 'Filter a list that has posts with that tag.' });
  }
  const without = posts.filter((p) => !p.tags.includes(clean(tag)));
  if (without.length) {
    throw friendly({ message: `Expected every post to have the tag "${tag}", but ${without.length} of ${posts.length} do not: ${listed(without.map((p) => p.title))}.`, hint: 'A list filtered by a tag shows only the posts with that tag.' });
  }
});

// ---------------------------------------------------------------------------
// The pager of a long list: the pagination of the page (`.pagination`, or a
// navigation of numbered links), its current page and its previous and next
// links.
// ---------------------------------------------------------------------------

/** The pager of the page: its items in order, as `{text, href, current, disabled, index}`. */
async function pagerItems(world) {
  return world.page.evaluate(() => {
    const pager = document.querySelector('.pagination, nav[aria-label*="agination" i] ul, nav.pagination');
    if (!pager) return null;
    const items = [...pager.querySelectorAll(':scope > li, :scope > a, :scope > span')];
    return items.map((item, index) => {
      const link = item.matches('a') ? item : item.querySelector('a');
      const text = (item.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        index,
        text,
        number: (text.match(/^\d+/) || [])[0] || null,
        href: link ? link.href : null,
        current: item.classList.contains('active') || item.getAttribute('aria-current') === 'page' || !!item.querySelector('[aria-current="page"]'),
        disabled: item.classList.contains('disabled') || !link,
      };
    });
  }).catch(() => null);
}

async function requirePager(world) {
  const items = await pagerItems(world);
  if (!items || !items.length) {
    throw friendly({ message: `This page has no pager (${world.page.url()}).`, hint: 'A list longer than one page shows a pager (.pagination) under it.' });
  }
  return items;
}

/** Follow a link of the pager, by the item it is. */
async function followPager(world, item, label) {
  const link = world.page.locator('.pagination, nav[aria-label*="agination" i] ul, nav.pagination').first().locator(':scope > li, :scope > a, :scope > span').nth(item.index).locator('xpath=descendant-or-self::a').first();
  await navigating(world, () => link.click(), { label });
}

/**
 * Go to a page of a long list by its number, with the pager under it.
 *
 * Example #1: When I go to page 2 of the list
 * Example #2: When we go to page 3 of the list
 * Example #3: And I go to page 1 of the list
 * Example #4: When I go to page 2 of the list
 * Example #5: Given we go to page 3 of the list
 */
When(/^(I |we )*go to page (\d+) of the list$/, async function (pronounCase, number) {
  const items = await requirePager(this);
  const item = items.find((i) => i.number === String(number));
  if (!item || item.disabled) {
    throw friendly({ message: `The pager has no link to page ${number}. Its pages: ${listed(items.filter((i) => i.number).map((i) => i.number))}${item && item.current ? ` (page ${number} is the current one)` : ''}.`, hint: 'Go to a page the pager links to.' });
  }
  await followPager(this, item, `Page ${number} of the list`);
});

/**
 * Go to the next or the previous page of a long list, with the first or the
 * last link of its pager.
 *
 * Example #1: When I go to the next page of the list
 * Example #2: When I go to the previous page of the list
 * Example #3: And we go to the next page of the list
 * Example #4: When we go to the previous page of the list
 * Example #5: Given I go to the next page of the list
 */
When(/^(I |we )*go to the (next|previous) page of the list$/, async function (pronounCase, which) {
  const items = await requirePager(this);
  const item = which === 'next' ? items[items.length - 1] : items[0];
  if (item.number || item.disabled) {
    throw friendly({ message: `The list has no ${which} page: the ${which === 'next' ? 'last' : 'first'} item of its pager is "${item.text}"${item.disabled ? ', and it is disabled' : ''}.`, hint: `There is no ${which} page on the ${which === 'next' ? 'last' : 'first'} page of a list.` });
  }
  await followPager(this, item, `The ${which} page of the list`);
});

/**
 * Assert the page of a long list the browser shows: the item its pager marks
 * as the current one.
 *
 * Example #1: Then the list should be on page 2
 * Example #2: Then the list should be on page 1
 * Example #3: And the list should be on page 3
 * Example #4: Then the list should be on page 2
 * Example #5: But the list should be on page 1
 */
Then(/^the list should be on page (\d+)$/, async function (number) {
  const items = await requirePager(this);
  const current = items.filter((i) => i.current).map((i) => i.number || i.text);
  if (!current.includes(String(number))) {
    throw friendly({ message: `Expected the list to be on page ${number}, but its pager marks ${listed(current)} as the current page.`, hint: 'The pager marks the current page (active, aria-current="page").' });
  }
});

/**
 * Assert how many pages a long list has: the numbered items of its pager.
 *
 * Example #1: Then the list should have 3 pages
 * Example #2: Then the list should have 2 pages
 * Example #3: And the list should have 1 page
 * Example #4: Then the list should have 3 pages
 * Example #5: Then the list should have 4 pages
 */
Then(/^the list should have (\d+) pages?$/, async function (count) {
  const items = (await pagerItems(this)) || [];
  const pages = items.filter((i) => i.number).length || (Number(count) === 1 && !items.length ? 1 : 0);
  if (pages !== Number(count)) {
    throw friendly({ message: `Expected the list to have ${count} page(s), but its pager has ${pages}: ${listed(items.filter((i) => i.number).map((i) => i.number))}.`, hint: 'The step counts the numbered items of the pager; a list of one page has no pager.' });
  }
});

/**
 * Assert that a long list has no next page (on its last page) or no previous
 * page (on its first one): that link of the pager is disabled.
 *
 * Example #1: Then the list should have no previous page
 * Example #2: Then the list should have no next page
 * Example #3: And the list should have no previous page
 * Example #4: But the list should have no next page
 * Example #5: Then the list should have no previous page
 */
Then(/^the list should have no (next|previous) page$/, async function (which) {
  const items = await requirePager(this);
  const item = which === 'next' ? items[items.length - 1] : items[0];
  if (!item.number && !item.disabled) {
    throw friendly({ message: `Expected the list to have no ${which} page, but its pager links "${item.text}" to ${item.href}.`, hint: `The ${which} link of the pager is disabled on the ${which === 'next' ? 'last' : 'first'} page.` });
  }
});

// ---------------------------------------------------------------------------
// Comments: the comment form of a post and the comments under it.
// ---------------------------------------------------------------------------

/** The comments under a post: `{author, text}` of each comment row (the line "Be the first…" is none). */
async function postComments(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('.post-comment, .comment, article.comment, [id^="comment-"]')].map((row) => {
    const head = row.querySelector('h4, h5, header, .comment-author, strong');
    const author = head ? (head.querySelector('strong') || head).textContent.replace(/\s+/g, ' ').trim() : '';
    const body = row.querySelector('.col-sm-9, .comment-content, .comment-body, p');
    return { author, head: head ? head.textContent.replace(/\s+/g, ' ').trim() : '', text: body ? body.textContent.replace(/\s+/g, ' ').trim() : '' };
  }).filter((c) => c.author && c.text)).catch(() => []);
}

/** The comment form of the page: a form with a text area and a button that publishes it. */
function commentForm(world) {
  return world.page.locator('form:has(textarea)').filter({ hasText: /comment/i }).first();
}

/**
 * Publish a comment on the post the page shows, as a person does: write it in
 * the comment form and press its button. The page of the post comes back with
 * the comment, or the form comes back with what it refused.
 *
 * Example #1: When I publish the comment "A comment of the webship-js suite."
 * Example #2: When we publish the comment "Thanks for this post."
 * Example #3: And I publish the comment "abc"
 * Example #4: When I publish the comment "Another comment of the suite."
 * Example #5: Given I publish the comment "A comment of the webship-js suite."
 */
When(/^(I |we )*publish the comment "([^"]*)"$/, async function (pronounCase, text) {
  const form = commentForm(this);
  if (!(await form.count()) || !(await form.isVisible().catch(() => false))) {
    throw friendly({ message: `This page has no comment form (${this.page.url()}).`, hint: 'The comment form is on the page of a post, for an account that signed in with its password in this session.' });
  }
  await form.locator('textarea').first().fill(text);
  const submit = form.locator('button[type="submit"], input[type="submit"], button:not([type])').filter({ visible: true }).first();
  await navigating(this, () => submit.click(), { label: 'Publishing the comment' });
});

/**
 * Assert how many comments the post the page shows has: its comment rows.
 *
 * Example #1: Then the post should have 5 comments
 * Example #2: Then the post should have 6 comments
 * Example #3: And the post should have 1 comment
 * Example #4: Then the post should have 0 comments
 * Example #5: Then the post should have 5 comments
 */
Then(/^the post should have (\d+) comments?$/, async function (count) {
  await eventually(this, () => postComments(this), (comments) => comments.length === Number(count), (comments) => ({
    message: `Expected the post to have ${count} comment(s), but it shows ${comments.length}.`,
    hint: 'The step counts the comment rows under the post.',
  }));
});

/**
 * Assert a comment under the post the page shows: its text, and the person
 * who wrote it (a handle of the users registry stands for its name).
 *
 * Example #1: Then I should see the comment "A comment of the webship-js suite." by "user"
 * Example #2: Then I should see the comment "A comment of the webship-js suite." by "John Doe"
 * Example #3: And we should see the comment "Thanks for this post." by "administrator"
 * Example #4: Then I should not see the comment "abc" by "user"
 * Example #5: But I should not see the comment "A comment of the webship-js suite." by "administrator"
 */
Then(/^(I |we )*should( not)* see the comment "([^"]*)" by "([^"]*)"$/, async function (pronounCase, notCase, text, who) {
  const name = nameOf(this, who);
  const has = (comments) => comments.some((c) => c.author === clean(name) && c.text === clean(text));
  if (notCase) {
    await settle(this);
    if (has(await postComments(this))) {
      throw friendly({ message: `Expected no comment "${text}" by "${name}", but the post shows it.`, hint: 'The step reads the author and the text of each comment row.' });
    }
    return;
  }
  await eventually(this, () => postComments(this), has, (comments) => ({
    message: `Expected the comment "${text}" by "${name}". The post shows: ${listed(comments.map((c) => `${c.author}: ${c.text.slice(0, 60)}`))}.`,
    hint: 'The step reads the author and the text of each comment row.',
  }));
});

// ---------------------------------------------------------------------------
// A field that updates the page while a person types in it.
// ---------------------------------------------------------------------------

/**
 * Type into a field key by key, as a person does, and wait for the page to
 * update: a field of a component that re-renders on the server waits until
 * the component is no longer busy and was rendered with what was typed; any
 * other field until the page's requests are done.
 *
 * Example #1: When I type "vulputate" in the "Search for..." field
 * Example #2: When we type "lorem" in the "Search for..." field
 * Example #3: And I type "no such words anywhere" in the "Search for..." field
 * Example #4: When I type "Ubi est" in the "Search for..." field
 * Example #5: When I type "" in the "Search for..." field
 */
When(/^(I |we )*type "([^"]*)" in the "([^"]*)" field$/, async function (pronounCase, value, field) {
  value = value || '';
  const control = await findField(this, field);
  await control.click();
  await control.fill('');
  if (value) await control.pressSequentially(value, { delay: 30 });
  else await control.dispatchEvent('input');
  const live = await control.evaluate((el) => {
    const root = el.closest('[data-controller~="live"]');
    if (!root) return null;
    const model = el.getAttribute('data-model') || el.getAttribute('data-live-model') || '';
    return { model: model.replace(/^(?:[a-z]+\|)?(?:on\([^)]*\)\|)?/, '') };
  });
  if (!live) {
    await settle(this, budget(this));
    return;
  }
  await eventually(this, () => control.evaluate((el, model) => {
    const root = el.closest('[data-controller~="live"]');
    let props = {};
    try { props = JSON.parse(root.getAttribute('data-live-props-value') || '{}'); } catch (e) { props = {}; }
    return { busy: root.hasAttribute('busy') || root.getAttribute('aria-busy') === 'true', rendered: model ? props[model] : undefined };
  }, live.model), (state) => !state.busy && (!live.model || String(state.rendered === undefined ? '' : state.rendered) === value), (state) => ({
    message: `The part of the page around the "${field}" field did not update for "${value}" within the wait: it ${state.busy ? 'is still busy' : `was last rendered for "${state.rendered}"`}.`,
    hint: 'The component re-renders on the server after a short pause in the typing; it is marked busy while its request runs.',
  }), budget(this) * 2);
  await settle(this);
});
