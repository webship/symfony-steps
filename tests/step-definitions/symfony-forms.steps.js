'use strict';

// Forms as a person reads them: a field filled with a value of an account of
// the registry, a field that holds one, the error the form prints under a
// field (or none), a field the browser refuses as empty, an error of the whole
// form, the messages a page shows after an action (the flash messages), the
// button that shows a password, a tags field and a date picker.
//
// The errors are found the way the form themes print them: the element the
// field's aria-describedby names (`<id>_error1`), `.invalid-feedback`,
// `.form-error-message`, or the list next to the widget.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  settle,
  eventually,
  resolveUser,
  findField,
  fieldErrors,
  pageFieldErrors,
  pageMessages,
} = require('./symfony-helpers');

// Which value of an account a step means.
const ACCOUNT_VALUES = { username: 'username', name: 'name', 'email address': 'email', password: 'password' };

/** A value of an account of the registry: its username, name, email address or password. */
function accountValue(world, what, handle) {
  const user = resolveUser(world, handle);
  const key = ACCOUNT_VALUES[what];
  const value = key === 'username' ? (user.username || user.login) : user[key];
  if (!value) {
    throw friendly({ message: `The user "${handle}" has no ${what} in the users registry.`, hint: `Set worldParameters.users.${handle}.${key} in cucumber.js.` });
  }
  return value;
}

/**
 * Fill a field with a value of an account of the users registry: its
 * username, name, email address or password. The field is found by its label
 * (or its name attribute); the value never has to be written into a feature.
 *
 * Example #1: When I fill in "Password" with the password of "user"
 * Example #2: When I fill in "Username" with the username of "administrator"
 * Example #3: And I fill in "Current password" with the password of "administrator"
 * Example #4: When we fill in "Fullname" with the name of "user"
 * Example #5: When I fill in "Email" with the email address of "administrator"
 */
When(/^(I |we )*fill in "([^"]*)" with the (username|name|email address|password) of "([^"]*)"$/, async function (pronounCase, field, what, handle) {
  const value = accountValue(this, what, handle);
  const control = await findField(this, field);
  await control.fill(value);
});

/**
 * Assert that a field holds a value of an account of the users registry: the
 * profile form shows the account's name, the login form keeps the username
 * that was refused.
 *
 * Example #1: Then the "Fullname" field should hold the name of "administrator"
 * Example #2: Then the "Username" field should hold the username of "user"
 * Example #3: And the "Email" field should hold the email address of "administrator"
 * Example #4: Then the "Fullname" field should not hold the name of "user"
 * Example #5: And the "Username" field should hold the username of "administrator"
 */
Then(/^the "([^"]*)" field should( not)* hold the (username|name|email address|password) of "([^"]*)"$/, async function (field, notCase, what, handle) {
  const value = accountValue(this, what, handle);
  const control = await findField(this, field);
  await eventually(this, () => control.inputValue().catch(() => ''), (seen) => (seen === value) !== !!notCase, (seen) => ({
    message: notCase
      ? `Expected the "${field}" field not to hold the ${what} of "${handle}" ("${value}"), but it does.`
      : `Expected the "${field}" field to hold the ${what} of "${handle}" ("${value}"), but it holds "${seen}".`,
    hint: `Check worldParameters.users.${handle} in cucumber.js and the account on the app.`,
  }));
});

/**
 * Assert the error the form prints for a field after it was sent: the message
 * the field's aria-describedby names, or the error line in the field's own
 * group (`.invalid-feedback`, `.form-error-message`, the list next to it).
 *
 * Example #1: Then the "Content" field should have the error "Post content is too short (10 characters minimum)"
 * Example #2: Then the "Current password" field should have the error "This value should be the user's current password."
 * Example #3: And the "New password" field should have the error "The values do not match."
 * Example #4: Then the "Summary" field should have the error "Give your post a summary!"
 * Example #5: Then the "Title" field should have the error "This title was already used in another blog post, but they must be unique."
 */
Then(/^the "([^"]*)" field should have the error "([^"]*)"$/, async function (field, message) {
  const control = await findField(this, field);
  await eventually(this, () => fieldErrors(control), (errors) => errors.some((e) => clean(e) === clean(message)), (errors) => ({
    message: errors.length
      ? `Expected the error "${message}" for the "${field}" field. It shows: ${listed(errors)}.`
      : `Expected the error "${message}" for the "${field}" field, but the field shows no error.`,
    hint: 'The step reads the error the form prints next to the field (the element its aria-describedby names, or .invalid-feedback in its group). Send the form first.',
  }));
});

/**
 * Assert that the form prints no error for a field.
 *
 * Example #1: Then the "Title" field should have no error
 * Example #2: Then the "Summary" field should have no error
 * Example #3: And the "Content" field should have no error
 * Example #4: Then the "Fullname" field should have no error
 * Example #5: But the "Email" field should have no error
 */
Then(/^the "([^"]*)" field should have no error$/, async function (field) {
  const control = await findField(this, field);
  await settle(this);
  const errors = await fieldErrors(control);
  if (errors.length) {
    throw friendly({ message: `Expected no error for the "${field}" field, but it shows: ${listed(errors)}.`, hint: 'The step reads the error the form prints next to the field.' });
  }
});

/**
 * Assert that the browser keeps a form from being sent while a required field
 * is empty: the field is required, it is empty, and the browser says it is not
 * valid. The form's own errors come only once the browser lets it through.
 *
 * Example #1: Then the "Title" field should block submission as required
 * Example #2: Then the "Content" field should block submission as required
 * Example #3: And the "Username" field should block submission as required
 * Example #4: Then the "Password" field should block submission as required
 * Example #5: Then the "Summary" field should block submission as required
 */
Then(/^the "([^"]*)" field should block submission as required$/, async function (field) {
  const control = await findField(this, field);
  const state = await control.evaluate((el) => ({ required: el.required, empty: !el.value, valid: el.checkValidity(), message: el.validationMessage }));
  if (!state.required || state.valid) {
    throw friendly({
      message: `Expected the "${field}" field to block submission as a required field, but it ${!state.required ? 'is not required' : 'is valid'} (value ${state.empty ? 'empty' : 'not empty'}).`,
      hint: 'The browser blocks a form while a field marked required is empty. Leave the field empty and press the submit button first.',
    });
  }
});

/**
 * Assert an error of the whole form, the one no field owns (a form sent with a
 * token that is no longer valid, a rule on the whole object): the form
 * theme prints it at the top of the form.
 *
 * Example #1: Then the form should have the error "The CSRF token is invalid. Please try to resubmit the form."
 * Example #2: Then the form should have the error "This form should not contain extra fields."
 * Example #3: And the form should have the error "The uploaded file was too large. Please try to upload a smaller file."
 * Example #4: Then the form should have the error "The CSRF token is invalid. Please try to resubmit the form."
 * Example #5: Then the form should have the error "This form should not contain extra fields."
 */
Then(/^the form should have the error "([^"]*)"$/, async function (message) {
  const read = () => this.page.evaluate(() => {
    const out = [];
    for (const form of document.querySelectorAll('form')) {
      for (const n of form.querySelectorAll('.alert, [role="alert"], .invalid-feedback, .form-error-message, :scope > ul > li, :scope > div > ul > li')) {
        const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
        const box = n.getBoundingClientRect();
        if (t && (box.width || box.height)) out.push(t);
      }
    }
    return [...new Set(out)];
  }).catch(() => []);
  await eventually(this, read, (errors) => errors.some((e) => clean(e) === clean(message)), (errors) => ({
    message: `Expected the form to show the error "${message}". It shows: ${listed(errors)}.`,
    hint: 'An error of the whole form is printed at its top. Send the form first.',
  }));
});

// The fields that carry the token of a form's CSRF protection, in the forms of the framework:
// `<form>[_token]` of a form type, `_csrf_token` of the login form, `_token` and `token` of a form
// written by hand.
const TOKEN_FIELDS = 'input[name$="[_token]"], input[name="_token"], input[name="_csrf_token"], input[name="token"], input[data-controller="csrf-protection"]';

/**
 * Press a button of a form after replacing the token of its CSRF protection
 * with one the app never gave (what a forged request carries), as an attacker
 * who copies a form does. The app must refuse it: assert the error of the form
 * with the next step, and that nothing changed.
 *
 * Example #1: When I press "Save changes" with a forged token
 * Example #2: When we press "Create post" with a forged token
 * Example #3: And I press "Sign in" with a forged token
 * Example #4: When I press "Publish comment" with a forged token
 * Example #5: And I press "Delete post" with a forged token
 */
When(/^(I |we )*press "([^"]*)" with a forged token$/, async function (pronounCase, label) {
  const button = this.page.getByRole('button', { name: label, exact: true }).first();
  if (!(await button.count())) {
    throw friendly({ message: `No button "${label}" is on the page (${this.page.url()}).`, hint: 'Name the button as the page writes it.' });
  }
  // A value that is not a token of any kind: the script of the stateless protection leaves it as it is.
  const forged = await button.evaluate((el, selector) => {
    const form = el.form || el.closest('form') || (el.getAttribute('form') && document.getElementById(el.getAttribute('form')));
    if (!form) return -1;
    const fields = [...form.querySelectorAll(selector)];
    for (const field of fields) {
      field.value = 'forged token';
      field.defaultValue = 'forged token';
      field.removeAttribute('data-controller');
    }
    return fields.length;
  }, TOKEN_FIELDS);
  if (forged < 1) {
    throw friendly({
      message: forged < 0 ? `The button "${label}" is not part of a form.` : `The form of the button "${label}" carries no token of a CSRF protection.`,
      hint: 'A form of the app carries its token in a hidden field (<form>[_token], _csrf_token, _token or token). A form without one is not protected.',
    });
  }
  const navigation = this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: budget(this) }).catch(() => null);
  await button.click();
  await Promise.race([navigation, this.page.waitForTimeout(1500)]);
  await settle(this);
});

/**
 * Assert a message the page shows after an action: a flash message the app
 * set before the redirect, or an alert of the page. With a kind, the message
 * must be of that kind (success, error, warning, info), read from its class
 * (`alert-success`, `alert-danger`, `alert-warning`, `alert-info`).
 *
 * Example #1: Then I should see the success message "Post created successfully!"
 * Example #2: Then I should see the error message "Invalid credentials."
 * Example #3: And I should see the message "Post deleted successfully!"
 * Example #4: Then I should not see the success message "Post created successfully!"
 * Example #5: Then we should see the info message "After changing your password, you will be logged out of the application."
 */
Then(/^(I |we )*should( not)* see the (?:(success|error|warning|info) )?message "([^"]*)"$/, async function (pronounCase, notCase, kind, message) {
  const matches = (list) => list.some((m) => clean(m.text) === clean(message) && (!kind || m.kind === kind));
  if (notCase) {
    await settle(this);
    const list = await pageMessages(this);
    if (matches(list)) {
      throw friendly({ message: `Expected not to see the ${kind ? kind + ' ' : ''}message "${message}", but the page shows it.`, hint: 'A flash message is shown once, on the page after the action that set it.' });
    }
    return;
  }
  await eventually(this, () => pageMessages(this), matches, (list) => ({
    message: `Expected the ${kind ? kind + ' ' : ''}message "${message}". The page shows: ${list.length ? list.map((m) => `${m.kind || 'message'} "${m.text}"`).join(', ') : '(no message)'}.`,
    hint: list.some((m) => clean(m.text) === clean(message))
      ? 'The message is there, but of another kind: the kind is read from its class (alert-success, alert-danger, alert-warning, alert-info).'
      : 'A flash message is shown once, on the page after the action that set it; a reload or another page takes it away.',
  }));
});

/**
 * Close a message of the page with its close button, as a person does, and
 * wait for it to go: a dismissible alert fades out, then leaves the page.
 *
 * Example #1: When I close the message "Post created successfully!"
 * Example #2: When we close the message "Post deleted successfully!"
 * Example #3: And I close the message "User updated successfully!"
 * Example #4: When I close the message "Post updated successfully!"
 * Example #5: Then I close the message "Post created successfully!"
 */
When(/^(I |we )*close the message "([^"]*)"$/, async function (pronounCase, message) {
  const alerts = this.page.locator('.alert, [role="alert"], [role="status"]').filter({ hasText: message }).filter({ visible: true });
  if (!(await alerts.count())) {
    const shown = (await pageMessages(this)).map((m) => m.text);
    throw friendly({ message: `No message "${message}" is on the page. It shows: ${listed(shown)}.`, hint: 'A flash message is shown once, on the page after the action that set it.' });
  }
  const alert = alerts.first();
  const close = alert.locator('.btn-close, .close, [data-bs-dismiss="alert"], [data-dismiss="alert"], button[aria-label]').first();
  if (!(await close.count())) {
    throw friendly({ message: `The message "${message}" has no close button.`, hint: 'Only a dismissible message (a close button with data-bs-dismiss="alert") can be closed.' });
  }
  await close.click();
  try {
    await alert.waitFor({ state: 'hidden', timeout: budget(this) });
  } catch (err) {
    throw friendly({ message: `The message "${message}" did not go after its close button was pressed.`, cause: err, hint: 'A dismissible alert fades out, then leaves the page.' });
  }
});

/**
 * Show the value of a password field with the button next to it, as a person
 * does to check what they typed.
 *
 * Example #1: When I show the value of the "Password" field
 * Example #2: When we show the value of the "Password" field
 * Example #3: And I show the value of the "Password" field
 * Example #4: When I show the value of the "Password" field
 * Example #5: Then I show the value of the "Password" field
 */
When(/^(I |we )*show the value of the "([^"]*)" field$/, async function (pronounCase, field) {
  const control = await findField(this, field);
  const button = control.locator('xpath=ancestor::*[self::div or self::span][1]').locator('button').first();
  if (!(await button.count())) {
    throw friendly({ message: `The "${field}" field has no button next to it that shows its value.`, hint: 'A password field with a show button sits in a group with that button (the login form of the demo).' });
  }
  await button.click();
});

/**
 * Assert that a password field shows its value (its type is text), or keeps
 * it hidden (its type is password).
 *
 * Example #1: Then the "Password" field should show its value
 * Example #2: Then the "Password" field should not show its value
 * Example #3: And the "Password" field should show its value
 * Example #4: But the "Password" field should not show its value
 * Example #5: Then the "Password" field should show its value
 */
Then(/^the "([^"]*)" field should( not)* show its value$/, async function (field, notCase) {
  const control = await findField(this, field);
  await eventually(this, () => control.getAttribute('type'), (type) => (type === 'text') !== !!notCase, (type) => ({
    message: `Expected the "${field}" field ${notCase ? 'to keep its value hidden' : 'to show its value'}, but its type is "${type}".`,
    hint: 'The button next to the field switches its type between password and text.',
  }));
});

// ---------------------------------------------------------------------------
// A tags field: the visible input of a tags widget (one chip per tag), with
// the field the form sends kept hidden next to it.
// ---------------------------------------------------------------------------

/** The tags widget of a field: the field the form sends (by its label) and the input a person types in. */
async function tagsWidget(world, field) {
  const page = world.page;
  const label = page.locator('label').filter({ hasText: new RegExp(`^\\s*${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first();
  const id = (await label.count()) ? await label.getAttribute('for') : null;
  const target = id ? page.locator(`[id="${id}"]`) : page.locator(`[name="${field}"]`);
  if (!(await target.count())) {
    throw friendly({ message: `No tags field "${field}" is on the page (${page.url()}).`, hint: 'Name the field by its label as the page writes it ("Tags").' });
  }
  const group = target.first().locator('xpath=ancestor::div[1]');
  const input = group.locator('.bootstrap-tagsinput input.tt-input, .bootstrap-tagsinput input:not(.tt-hint), .tagify__input, input[role="combobox"]').filter({ visible: true }).first();
  if (!(await input.count())) {
    throw friendly({ message: `The "${field}" field is not a tags field: no input of a tags widget is next to it.`, hint: 'A tags field shows one chip per tag and an input to type a new one in.' });
  }
  return { target: target.first(), group, input };
}

/** The tags a tags widget shows, as chips. */
async function tagsOf(widget) {
  return (await widget.group.locator('.bootstrap-tagsinput .tag, .tagify__tag, .badge').allInnerTexts().catch(() => [])).map(clean).filter(Boolean);
}

/**
 * Add a tag to a tags field as a person does: type it in the field's input and
 * press Enter; the widget turns it into a chip. Use a tag the app already has:
 * a new one is saved with the form and stays.
 *
 * Example #1: When I add the tag "lorem" to the "Tags" field
 * Example #2: When we add the tag "ipsum" to the "Tags" field
 * Example #3: And I add the tag "dolore" to the "Tags" field
 * Example #4: When I add the tag "pariatur" to the "Tags" field
 * Example #5: And we add the tag "labore" to the "Tags" field
 */
When(/^(I |we )*add the tag "([^"]*)" to the "([^"]*)" field$/, async function (pronounCase, tag, field) {
  const widget = await tagsWidget(this, field);
  await widget.input.click();
  await widget.input.fill(tag);
  await widget.input.press('Enter');
  await eventually(this, () => tagsOf(widget), (tags) => tags.includes(tag), (tags) => ({
    message: `The tag "${tag}" did not become a chip of the "${field}" field. Its tags: ${listed(tags)}.`,
    hint: 'The widget turns what was typed into a chip on Enter.',
  }));
});

/**
 * Remove a tag from a tags field with the cross of its chip.
 *
 * Example #1: When I remove the tag "lorem" from the "Tags" field
 * Example #2: When we remove the tag "ipsum" from the "Tags" field
 * Example #3: And I remove the tag "dolore" from the "Tags" field
 * Example #4: When I remove the tag "pariatur" from the "Tags" field
 * Example #5: And we remove the tag "labore" from the "Tags" field
 */
When(/^(I |we )*remove the tag "([^"]*)" from the "([^"]*)" field$/, async function (pronounCase, tag, field) {
  const widget = await tagsWidget(this, field);
  const chip = widget.group.locator('.bootstrap-tagsinput .tag, .tagify__tag').filter({ hasText: new RegExp(`^\\s*${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first();
  if (!(await chip.count())) {
    throw friendly({ message: `The "${field}" field has no tag "${tag}". Its tags: ${listed(await tagsOf(widget))}.`, hint: 'Remove a tag the field shows as a chip.' });
  }
  await chip.locator('[data-role="remove"], .tagify__tag__removeBtn, button').first().click();
  await eventually(this, () => tagsOf(widget), (tags) => !tags.includes(tag), (tags) => ({
    message: `The tag "${tag}" is still a chip of the "${field}" field. Its tags: ${listed(tags)}.`,
    hint: 'The cross of a chip removes the tag.',
  }));
});

/**
 * Assert the tags of a tags field: the chips it shows, in any order, and the
 * value the form sends with them.
 *
 * Example #1: Then the "Tags" field should have the tags "lorem"
 * Example #2: Then the "Tags" field should have the tags "lorem, ipsum"
 * Example #3: And the "Tags" field should have the tags ""
 * Example #4: Then the "Tags" field should have the tags "dolore, labore, pariatur"
 * Example #5: And the "Tags" field should have the tags "ipsum"
 */
Then(/^the "([^"]*)" field should have the tags "([^"]*)"$/, async function (field, list) {
  const wanted = String(list || '').split(',').map(clean).filter(Boolean).sort();
  const widget = await tagsWidget(this, field);
  const read = async () => ({ chips: (await tagsOf(widget)).sort(), value: String(await widget.target.inputValue().catch(() => '')).split(',').map(clean).filter(Boolean).sort() });
  await eventually(this, read, (seen) => JSON.stringify(seen.chips) === JSON.stringify(wanted) && JSON.stringify(seen.value) === JSON.stringify(wanted), (seen) => ({
    message: `Expected the "${field}" field to have the tags ${listed(wanted)}. It shows ${listed(seen.chips)} and sends ${listed(seen.value)}.`,
    hint: 'The chips are the tags a person sees; the hidden field next to them is what the form sends.',
  }));
});

/**
 * Set a date picker field to a date and a time, the way its picker does (the
 * picker of the field takes the value and closes, the field shows it), so a
 * scheduled date can be chosen without walking through the calendar.
 *
 * Example #1: When I set the "Published at" date to "2030-01-01 10:00"
 * Example #2: When we set the "Published at" date to "2026-01-01 08:30"
 * Example #3: And I set the "Published at" date to "2031-06-15 12:00"
 * Example #4: When I set the "Published at" date to "2029-12-31 23:59"
 * Example #5: And we set the "Published at" date to "2030-01-01 10:00"
 */
When(/^(I |we )*set the "([^"]*)" date to "([^"]*)"$/, async function (pronounCase, field, value) {
  const control = await findField(this, field);
  const used = await control.evaluate((el, v) => {
    const picker = el._flatpickr || (el.closest('.flatpickr') && el.closest('.flatpickr')._flatpickr);
    if (picker) {
      picker.setDate(v, true, picker.config.dateFormat);
      picker.close();
      return 'picker';
    }
    return '';
  }, value);
  if (!used) {
    await control.fill(value);
    await control.dispatchEvent('change');
  }
  await eventually(this, () => control.inputValue(), (seen) => clean(seen) === clean(value), (seen) => ({
    message: `The "${field}" field shows "${seen}" after it was set to "${value}".`,
    hint: 'Write the date in the format the field shows (for example "2030-01-01 10:00").',
  }));
});
