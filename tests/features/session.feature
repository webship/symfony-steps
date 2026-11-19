@session
Feature: The session
  As a person with an account on the app
  I want to log in, stay logged in and log out
  So that only I act as me, and a page that needs an account asks for one

  # The accounts are the ones of the users registry in cucumber.js (administrator, user): the demo's
  # own users. A scenario never creates or deletes one.

  @critical
  Scenario: The login form is served
    Given I am an anonymous user
    When I go to "/en/login"
    Then the response status code should be 200
    And I should see the login form
    And the "Keep me logged in" checkbox should be checked

  @critical
  Scenario: An administrator logs in with the form and lands on the post list
    Given I am an anonymous user
    When I log in as "administrator" with the login form
    Then I should be on "/en/admin/post/"
    And I should be logged in as "administrator"
    And the user menu should name "administrator"

  Scenario: A wrong password is refused with the reason, and the username is kept
    Given I am an anonymous user
    When I go to "/en/login"
    And I fill in "Username" with the username of "administrator"
    And I fill in "Password" with "wrong-password"
    And I press "Sign in"
    Then I should see the login form
    And I should see the error message "Invalid credentials."
    And the "Username" field should hold the username of "administrator"
    And I should not be logged in

  Scenario: An unknown username is refused with the same reason
    Given I am an anonymous user
    When I log in with the username "no_such_account" and the password "kitten"
    Then I should see the error message "Invalid credentials."

  Scenario: An empty password is stopped by the browser
    Given I am an anonymous user
    When I go to "/en/login"
    And I fill in "Username" with the username of "user"
    And I press "Sign in"
    Then the "Password" field should block submission as required
    And I should be on "/en/login"

  Scenario: A page that needs an account sends a visitor to the login form
    Given I am an anonymous user
    When I go to "/en/profile/edit"
    Then I should see the login form

  Scenario: The session holds through a reload and another page
    Given I am a logged in user with the "user" user
    When I reload the page
    And I go to "/en/blog/search"
    Then I should be logged in as "user"

  Scenario: Logging out ends the session
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/"
    And I log out
    Then I should be on the homepage
    And I should not be logged in

  Scenario: "Keep me logged in" leaves a cookie that outlasts the session
    Given I am an anonymous user
    When I log in as "administrator" with the login form and "Keep me logged in" checked
    Then a cookie with the name "REMEMBERME" should exist

  Scenario: Without "Keep me logged in" the browser keeps no such cookie
    Given I am an anonymous user
    When I log in as "administrator" with the login form and "Keep me logged in" unchecked
    Then a cookie with the name "REMEMBERME" should not exist
    And I should be logged in

  Scenario: The password field shows what was typed on request
    Given I am an anonymous user
    When I go to "/en/login"
    And I fill in "Password" with the password of "user"
    Then the "Password" field should not show its value
    When I show the value of the "Password" field
    Then the "Password" field should show its value
