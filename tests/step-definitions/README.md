# Step definitions

| File | Covers |
| --- | --- |
| `symfony-session.steps.js` | The session: login by a handle of the users registry (a session taken over when the account already has one), login through the form (a checkbox of the form on the way), login with a username or an address and a password, logout, who is signed in, the login form. |
| `symfony-forms.steps.js` | Forms as a person reads them: a field filled with a value of an account of the registry, a field that holds one, the error the form prints for a field (or none), a field the browser refuses as empty, an error of the whole form, a form sent with a forged token, the messages of a page (flash messages and alerts, by kind), closing a message, the button that shows a password, a tags field, a date picker. |
| `symfony-app.steps.js` | The frame of the app: the user menu (open an item, what it offers, the account it names), the navigation (its items, the current page), the language chooser (choose a language, what it offers, the current one) and the direction the page is written in. |
| `symfony-blog.steps.js` | The blog of the demo: the posts of a list, a post opened by its title, its author and its tags, a tag that filters the list, the pager, the comments and the comment form, a field that updates the page while a person types in it. |
| `symfony-errors.steps.js` | The framework's own pages and tools: the error page of a status, the debug information a live app must not show, a form sent from another site, the debug toolbar of a development app (status, route, account, logged errors, database queries), the profiler (the request it shows, its panels). |
| `symfony-mail.steps.js` | The mail the app sends, read in the mailbox of the test app: an e-mail by its subject, its text, the absence of any, and a link of it opened as a person does. |
| `symfony-helpers.js` | Shared plumbing: the wait budget, the requests of the page, friendly errors, the users registry and the session cache, fields and their errors, messages, the user menu, the navigation, the language chooser, the mailbox, the status of the page, the debug toolbar. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill, see, modal, table and response vocabulary already covers
  is not added here.
- No step phrase names the framework or a library. A name appears only as an
  argument a step asserts.
- The regular expression starts with the pronoun group `(I |we )*` where a
  person acts, and an assertion takes `should( not)*`, so one definition reads
  both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Find things the way a person does: a label, a role, a text. What the
  framework prints the same way in every app is the fallback: the field names
  of the login form (`_username`, `_password`, `_remember_me`, `_target_path`),
  the ids and classes of the form themes (`<id>_error1`, `.invalid-feedback`,
  `.form-error-message`), `aria-describedby`, `hreflang`, the toolbar's blocks.
- Wait on the page, never on a fixed time: on the locator, on the requests of
  the page (`settle`, `navigating`), on a component that is busy, on the error
  under a field.
- Fail with `friendly({ message, hint })`: what was expected, what was found
  and where to look.
- A step never creates or deletes a user: accounts are configuration, named in
  the `users` registry of `cucumber.js` and created by the build of the app.
- Open the page in a real browser before writing or changing its step, and
  write the step from what is there.
- Give every assertion a scenario in `tests/must-fail/` that makes it fail.
