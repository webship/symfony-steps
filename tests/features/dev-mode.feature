@dev-mode
Feature: The tools of a development app
  As a developer of the app
  I want the debug toolbar on every page, the profiler of each request and the debug page of an error
  So that I see what a request did, and why it failed

  # A lane of its own: the app runs in the dev environment for it (APP_ENV=dev, APP_DEBUG=1), then
  # goes back to prod. The default run leaves it out (tags: not @dev-mode).

  Scenario: The debug toolbar reports the request of the page
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then I should see the debug toolbar
    And the debug toolbar should show the status code 200
    And the debug toolbar should show the route "blog_index"
    And the debug toolbar should show no account
    And the debug toolbar should show 0 logged errors
    And the debug toolbar should show at most 10 database queries
    And the response should contain the header "x-debug-token"
    And the page should show debug information

  Scenario: The debug toolbar names the signed-in account
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/"
    Then the debug toolbar should show the route "admin_index"
    And the debug toolbar should show the account "administrator"

  Scenario: The profiler shows the request of the page and its panels
    Given I am an anonymous user
    When I go to "/en/blog/"
    And I open the profiler of the page
    Then the profiler should show the "GET" request to "/en/blog/" with the status 200
    When I open the "Logs" panel of the profiler
    Then I should see "Log Messages"
    When I open the "Routing" panel of the profiler
    Then I should see "blog_index"

  @js-off
  Scenario: An address the app does not have shows the debug page, not the 404 page
    Given I am an anonymous user
    When I go to "/en/no-such-page-of-the-app"
    Then the response status code should be 404
    And the page should show debug information
    And I should not see the 404 error page

  @js-off
  Scenario: An error nothing catches shows the debug page with its message
    Given I am an anonymous user
    When I go to "/en/test-fixtures/server-error"
    Then the response status code should be 500
    And the page should show debug information
    And I should see "The test app raised this error on purpose."
