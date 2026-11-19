@must-fail @dev-mode
Feature: Assertions that must fail: the tools of a development app
  Each scenario asserts something that is not true on the test app in the dev environment. Its steps
  before the last one pass; the last one must fail, with the message its description announces and
  a hint. They run in the dev lane (MUST_FAIL_TAGS="@dev-mode").

  Scenario: A page of a development app is said to show no debug information
    Fails with: The page shows debug information: the debug toolbar
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the page should not show debug information

  Scenario: A page that draws the debug toolbar is said to draw none
    Fails with: Expected no debug toolbar, but the page carries one
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then I should not see the debug toolbar

  Scenario: The toolbar is said to report another status
    Fails with: Expected the debug toolbar to show the status code 404, but it shows "200 OK".
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the debug toolbar should show the status code 404

  Scenario: The toolbar is said to report another route
    Fails with: Expected the debug toolbar to show the route "blog_post", but it shows "blog_index".
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the debug toolbar should show the route "blog_post"

  Scenario: The toolbar of a visitor is said to name an account
    Fails with: Expected the debug toolbar to show the account
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the debug toolbar should show the account "administrator"

  Scenario: The toolbar of an account is said to name nobody
    Fails with: Expected the debug toolbar to show no account, but it shows
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/"
    Then the debug toolbar should show no account

  Scenario: The toolbar is said to count a logged error
    Fails with: Expected the debug toolbar to show 1 logged error(s), but it shows 0.
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the debug toolbar should show 1 logged error

  Scenario: The list is said to run a single database query
    Fails with: Expected at most 1 database queries, but the request of the page ran
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the debug toolbar should show at most 1 database query

  Scenario: The profiler is said to show another request
    Fails with: Expected the profiler to show the "POST" request to "/en/blog/", but it shows "GET https://
    Given I am an anonymous user
    When I go to "/en/blog/"
    And I open the profiler of the page
    Then the profiler should show the "POST" request to "/en/blog/"
