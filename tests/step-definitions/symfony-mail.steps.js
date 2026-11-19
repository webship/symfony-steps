'use strict';

// The mail the app sends, read in the mailbox of the test app (Mailpit, which
// every DDEV project has at port 8026; `worldParameters.mailUrl`): an e-mail by
// its subject, its text, the absence of any, and a link of it opened as a
// person does. The demo mails the author of a post when somebody comments on it.
//
// A mail step reads only the mail that arrived since the scenario started:
// never a mail of an earlier scenario or run.

const { Before, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  open,
  addressOf,
  mailList,
  mailTo,
  mailLink,
} = require('./symfony-helpers');

Before(function () {
  this.__scenarioStartedAt = Date.now();
});

/** The moment from which a mail step reads the mailbox. */
function mailSince(world) {
  return world.__scenarioStartedAt || 0;
}

/**
 * Assert that the app sent an e-mail with a subject to an address (a handle of
 * the users registry stands for its address) since the scenario started.
 *
 * Example #1: Then an email with the subject "Your post received a comment!" should be sent to "administrator"
 * Example #2: Then an email with the subject "Your post received a comment!" should be sent to "jane_admin@example.com"
 * Example #3: And an email with the subject "Your post received a comment!" should be sent to "user"
 * Example #4: Then an email with the subject "Your post received a comment!" should be sent to "administrator"
 * Example #5: And an email with the subject "Your post received a comment!" should be sent to "john_user@example.com"
 */
Then(/^an email with the subject "([^"]*)" should be sent to "([^"]*)"$/, async function (subject, who) {
  await mailTo(this, addressOf(this, who), { since: mailSince(this), subject });
});

/**
 * Assert that the app sent no e-mail to an address since the scenario started.
 * The step gives the app a moment to send one first.
 *
 * Example #1: Then no email should be sent to "user"
 * Example #2: Then no email should be sent to "administrator"
 * Example #3: And no email should be sent to "nobody@example.com"
 * Example #4: Then no email should be sent to "john_user@example.com"
 * Example #5: But no email should be sent to "user"
 */
Then(/^no email should be sent to "([^"]*)"$/, async function (who) {
  const address = addressOf(this, who);
  await this.page.waitForTimeout(1500);
  let messages;
  try {
    messages = (await mailList(this, address)).filter((message) => Date.parse(message.Created) >= mailSince(this) - 2000);
  } catch (err) {
    throw friendly({ message: `Could not read the mailbox: ${clean(err && err.message)}.`, hint: 'Check worldParameters.mailUrl in cucumber.js.' });
  }
  if (messages.length) {
    throw friendly({ message: `Expected no e-mail to ${address}, but the app sent: ${listed(messages.map((message) => message.Subject))}.`, hint: 'The step counts the mail that arrived since the scenario started.' });
  }
});

/**
 * Assert that an e-mail with a subject to an address holds a text (in its text
 * version, or in its HTML version without the tags).
 *
 * Example #1: Then the email with the subject "Your post received a comment!" to "administrator" should contain "has received a new comment"
 * Example #2: Then the email with the subject "Your post received a comment!" to "administrator" should contain "A post of the webship-js suite"
 * Example #3: And the email with the subject "Your post received a comment!" to "jane_admin@example.com" should contain "this link"
 * Example #4: Then the email with the subject "Your post received a comment!" to "user" should contain "has received a new comment"
 * Example #5: And the email with the subject "Your post received a comment!" to "administrator" should contain "this link"
 */
Then(/^the email with the subject "([^"]*)" to "([^"]*)" should contain "([^"]*)"$/, async function (subject, who, text) {
  const mail = await mailTo(this, addressOf(this, who), { since: mailSince(this), subject });
  const body = clean(`${mail.text} ${String(mail.html).replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, '&')}`);
  if (!body.includes(clean(text))) {
    throw friendly({ message: `The e-mail "${mail.subject}" to ${addressOf(this, who)} does not contain "${text}". It says: "${body.slice(0, 240)}".`, hint: 'The step reads the text of the e-mail, without its markup.' });
  }
});

/**
 * Open a link of an e-mail the app sent, by the text a person clicks, as a
 * person does: the newest e-mail to the address (a handle of the users
 * registry stands for its address) since the scenario started that holds such
 * a link.
 *
 * Example #1: When I open the "this link" link of the email to "administrator"
 * Example #2: When we open the "this link" link of the email to "jane_admin@example.com"
 * Example #3: And I open the "this link" link of the email to "user"
 * Example #4: When I open the "this link" link of the email to "administrator"
 * Example #5: Given we open the "this link" link of the email to "administrator"
 */
When(/^(I |we )*open the "([^"]*)" link of the email to "([^"]*)"$/, async function (pronounCase, label, who) {
  const address = addressOf(this, who);
  const deadline = Date.now() + budget(this) * 2;
  let link = null;
  let mail = null;
  for (;;) {
    mail = await mailTo(this, address, { since: mailSince(this), timeout: Math.max(deadline - Date.now(), 1000) });
    link = mailLink(mail, label);
    if (link.href || Date.now() > deadline) break;
    await this.page.waitForTimeout(300);
  }
  if (!link.href) {
    throw friendly({ message: `The newest e-mail to ${address} ("${mail.subject}") has no link "${label}". Its links: ${listed(link.anchors.map((a) => a.text))}.`, hint: 'Name the link by the text a person clicks in the e-mail.' });
  }
  await open(this, link.href);
});
