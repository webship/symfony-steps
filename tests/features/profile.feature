@profile
Feature: The profile of an account
  As a person with an account
  I want to see and change my details, and be kept from a mistake when I change my password
  So that the app knows me as I am

  # A scenario that changes a detail puts it back. No scenario changes a password for good: a
  # changed password logs the account out and the next run could not log in.

  @critical
  Scenario: The user menu leads to the profile, which holds the account's details
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/"
    Then the user menu should name "user"
    And the user menu should offer "Account"
    And the user menu should offer "Logout"
    And the user menu should not offer "Backend"
    When I open "Account" from the user menu
    Then I should be on "/en/profile/edit"
    And I should see "Edit user"
    And the "Username" field should hold the username of "user"
    And the "Fullname" field should hold the name of "user"
    And the "Email" field should hold the email address of "user"

  Scenario: A new name shows in the user menu, and the old one comes back
    Given I am a logged in user with the "user" user
    When I go to "/en/profile/edit"
    And I fill in "Fullname" with "John Webship"
    And I press "Save changes"
    Then I should see the success message "User updated successfully!"
    And the user menu should name "John Webship"
    When I fill in "Fullname" with the name of "user"
    And I press "Save changes"
    Then I should see the success message "User updated successfully!"
    And the user menu should name "user"
    And the "Fullname" field should hold the name of "user"

  Scenario: An address the rules refuse comes back with the reason under its field
    Given I am a logged in user with the "user" user
    When I go to "/en/profile/edit"
    And browser validation for the form "form[name=user]" is disabled
    And I fill in "Email" with "not-an-email"
    And I press "Save changes"
    Then the response status code should be 422
    And the "Email" field should have the error "This value is not a valid email address."
    And the "Fullname" field should have no error
    And I should not see the success message "User updated successfully!"
    When I go to "/en/profile/edit"
    Then the "Email" field should hold the email address of "user"

  Scenario: A wrong current password and two new passwords that differ are refused
    Given I am a logged in user with the "user" user
    When I go to "/en/profile/change-password"
    Then I should see the info message "After changing your password, you will be logged out of the application."
    When I fill in "Current password" with "not-my-password"
    And I fill in "New password" with "kitten-2026"
    And I fill in "Confirm password" with "kitten-2027"
    And I press "Save changes"
    Then the "Current password" field should have the error "This value should be the user's current password."
    And the "New password" field should have the error "The values do not match."
    And I should be logged in as "user"

  Scenario: A new password that is too short is refused, with the right current password
    Given I am a logged in user with the "user" user
    When I go to "/en/profile/change-password"
    And I fill in "Current password" with the password of "user"
    And I fill in "New password" with "abc"
    And I fill in "Confirm password" with "abc"
    And I press "Save changes"
    Then the "Current password" field should have no error
    And the "New password" field should have the error "This value is too short. It should have 5 characters or more."
    And I should be logged in as "user"
