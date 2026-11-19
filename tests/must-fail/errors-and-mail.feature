@must-fail
Feature: Assertions that must fail: the framework's pages and the mail
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.

  @js-off
  Scenario: The 404 page is said to be the 403 page
    Fails with: Expected the 403 error page, but the browser shows HTTP 404
    Given I am an anonymous user
    When I go to "/en/no-such-page-of-the-app"
    Then I should see the 403 error page

  @js-off
  Scenario: The 404 page is said not to be there
    Fails with: Expected not to see the 404 error page, but the browser shows it
    Given I am an anonymous user
    When I go to "/en/no-such-page-of-the-app"
    Then I should not see the 404 error page

  Scenario: A page of a live app is said to show debug information
    Fails with: Expected the page to show debug information, but it shows none
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the page should show debug information

  Scenario: A page of a live app is said to draw the debug toolbar
    Fails with: This page has no debug toolbar
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then I should see the debug toolbar

  Scenario: A mail is said to have been sent when none was
    Fails with: No e-mail "Your post received a comment!" to
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then an email with the subject "Your post received a comment!" should be sent to "user"

  Scenario: A mail the app sent is said not to have been sent
    Fails with: but the app sent: "Your post received a comment!".
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the must-fail run that mails its author"
    And I fill in "Summary" with "A post the must-fail run writes; its cleanup deletes it."
    And I fill in "Content" with "This post was written by the must-fail run of the webship-js suite."
    And I press "Create post"
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/posts/a-post-of-the-must-fail-run-that-mails-its-author"
    And I publish the comment "A comment of the must-fail run."
    Then no email should be sent to "administrator"

  Scenario: A mail is said to hold a text it does not hold
    Fails with: does not contain "Your order has shipped."
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the must-fail run whose mail is read"
    And I fill in "Summary" with "A post the must-fail run writes; its cleanup deletes it."
    And I fill in "Content" with "This post was written by the must-fail run of the webship-js suite."
    And I press "Create post"
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/posts/a-post-of-the-must-fail-run-whose-mail-is-read"
    And I publish the comment "A comment of the must-fail run."
    Then the email with the subject "Your post received a comment!" to "administrator" should contain "Your order has shipped."

  # The posts the scenarios above wrote go again: these scenarios run after them and must pass.
  @must-fail-cleanup
  Scenario Outline: The cleanup deletes a post of the must-fail run
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/"
    And I click "Edit" in the "<title>" row
    And I click the "Delete post" button
    And I click "Delete post" in the modal
    Then I should see the success message "Post deleted successfully!"

    Examples:
      | title                                             |
      | A post of the must-fail run with a tag            |
      | A post of the must-fail run with a comment        |
      | A post of the must-fail run that mails its author |
      | A post of the must-fail run whose mail is read    |
