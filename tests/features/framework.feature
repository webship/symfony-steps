@framework
Feature: What the framework answers in a live app
  As the owner of a live app
  I want errors answered with the app's own error pages, forged forms refused, and no tool of
  development in sight
  So that nobody learns how the app is built, and nobody acts in a person's name

  # The test app runs as a live app runs (APP_ENV=prod, APP_DEBUG=0). The 500 page comes from the
  # one page the test app adds to the demo, /en/test-fixtures/server-error. The scenarios that open
  # an error page carry @js-off: the browser logs "Failed to load resource" for each of them.

  @critical @js-off
  Scenario: An address the app does not have answers with the 404 page
    Given I am an anonymous user
    When I go to "/en/no-such-page-of-the-app"
    Then I should see the 404 error page
    And I should see "We couldn't find the page you requested."
    And the page should not show debug information

  @js-off
  Scenario: A page an account may not open answers with the 403 page
    Given I am a logged in user with the "user" user
    When I go to "/en/admin/post/new"
    Then I should see the 403 error page
    And the page should not show debug information

  @js-off
  Scenario: A method the route does not take answers with the 405 page
    Given I am an anonymous user
    When I go to "/en/admin/post/1/delete"
    Then I should see the 405 error page
    And the page should not show debug information

  @js-off
  Scenario: An error nothing catches answers with the 500 page, not the debug page
    Given I am an anonymous user
    When I go to "/en/test-fixtures/server-error"
    Then I should see the 500 error page
    And I should see "There was an internal server error."
    And the page should not show debug information

  Scenario: A live app draws no debug toolbar and sends no debug token
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then I should not see the debug toolbar
    And the response should not contain the header "x-debug-token"
    And the page should not show debug information

  @js-off
  Scenario: The profiler of a live app is not there
    Given I am an anonymous user
    When I go to "/_profiler/"
    Then I should see the 404 error page

  Scenario: A login form sent from another site is refused
    Given I am an anonymous user
    When a page of another site sends a form to "/en/login"
    Then I should be on "/en/login"
    And I should see the error message "Invalid CSRF token."
    And I should not be logged in

  Scenario: A form of the app sent with a token the app never gave is refused, and nothing changes
    Given I am a logged in user with the "user" user
    When I go to "/en/profile/edit"
    And I fill in "Fullname" with "John Forged"
    And I press "Save changes" with a forged token
    Then the form should have the error "The CSRF token is invalid. Please try to resubmit the form."
    And I should not see the success message "User updated successfully!"
    When I go to "/en/profile/edit"
    Then the "Fullname" field should hold the name of "user"

  Scenario: A post the delete form sends with a forged token stays
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the webship-js suite the forged form cannot delete"
    And I fill in "Summary" with "A post the suite writes and deletes again."
    And I fill in "Content" with "This post was written by the webship-js suite and is deleted again."
    And I press "Create post"
    And I click "Edit" in the "A post of the webship-js suite the forged form cannot delete" row
    And I press "Delete post" with a forged token
    And I click "Delete post" in the modal
    Then I should be on "/en/admin/post/"
    And I should not see the success message "Post deleted successfully!"
    And I should see "A post of the webship-js suite the forged form cannot delete" in the "A post of the webship-js suite the forged form cannot delete" row
    When I click "Edit" in the "A post of the webship-js suite the forged form cannot delete" row
    And I click the "Delete post" button
    And I click "Delete post" in the modal
    Then I should see the success message "Post deleted successfully!"
