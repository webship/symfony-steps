@must-fail
Feature: Assertions that must fail: the session and the forms
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.

  Scenario: A visitor is said to be logged in
    Fails with: Expected to be logged in, but /en/profile/edit sent the browser to the login form.
    Given I am an anonymous user
    Then I should be logged in

  Scenario: A signed-in account is said to be logged out
    Fails with: Expected nobody to be logged in, but /en/profile/edit opened without the login form
    Given I am a logged in user with the "user" user
    Then I should not be logged in

  Scenario: The other account is said to be logged in
    Fails with: to be logged in, but the user menu names
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/"
    Then I should be logged in as "administrator"

  Scenario: The login form is said to be gone from the login page
    Fails with: Expected not to see the login form, but it is on the page.
    Given I am an anonymous user
    When I go to "/en/login"
    Then I should not see the login form

  Scenario: A page without a login form is said to show one
    Fails with: Expected to see the login form, but it did not appear within
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then I should see the login form

  Scenario: A field is said to hold the name of the other account
    Fails with: Expected the "Fullname" field to hold the name of "administrator"
    Given I am a logged in user with the "user" user
    When I go to "/en/profile/edit"
    Then the "Fullname" field should hold the name of "administrator"

  Scenario: A field is said not to hold the name it holds
    Fails with: Expected the "Fullname" field not to hold the name of "user"
    Given I am a logged in user with the "user" user
    When I go to "/en/profile/edit"
    Then the "Fullname" field should not hold the name of "user"

  Scenario: A field is said to show another error than the one it shows
    Fails with: Expected the error "Your post should have some content!" for the "Content" field. It shows: "Post content is too short (10 characters minimum)".
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the must-fail run that is refused"
    And I fill in "Summary" with "A summary."
    And I fill in "Content" with "Too short"
    And I press "Create post"
    Then the "Content" field should have the error "Your post should have some content!"

  Scenario: A field that shows an error is said to show none
    Fails with: Expected no error for the "Content" field, but it shows: "Post content is too short (10 characters minimum)".
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the must-fail run that is refused"
    And I fill in "Summary" with "A summary."
    And I fill in "Content" with "Too short"
    And I press "Create post"
    Then the "Content" field should have no error

  Scenario: A filled field is said to block the form as required
    Fails with: Expected the "Username" field to block submission as a required field, but it is valid
    Given I am an anonymous user
    When I go to "/en/login"
    And I fill in "Username" with the username of "user"
    Then the "Username" field should block submission as required

  Scenario: A form that was not sent is said to show an error
    Fails with: Expected the form to show the error "The CSRF token is invalid. Please try to resubmit the form.". It shows: (none).
    Given I am a logged in user with the "user" user
    When I go to "/en/profile/edit"
    Then the form should have the error "The CSRF token is invalid. Please try to resubmit the form."

  Scenario: A message that is not on the page is said to be there
    Fails with: Expected the success message "Post created successfully!". The page shows: (no message).
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then I should see the success message "Post created successfully!"

  Scenario: An error message is said to be a success message
    Fails with: Expected the success message "Invalid credentials.". The page shows: error "Invalid credentials.".
    Given I am an anonymous user
    When I log in with the username "no_such_account" and the password "kitten"
    Then I should see the success message "Invalid credentials."

  Scenario: A message on the page is said to be gone
    Fails with: Expected not to see the error message "Invalid credentials.", but the page shows it.
    Given I am an anonymous user
    When I log in with the username "no_such_account" and the password "kitten"
    Then I should not see the error message "Invalid credentials."

  Scenario: A password field that shows its value is said to hide it
    Fails with: Expected the "Password" field to keep its value hidden, but its type is "text".
    Given I am an anonymous user
    When I go to "/en/login"
    And I show the value of the "Password" field
    Then the "Password" field should not show its value

  Scenario: A password field that hides its value is said to show it
    Fails with: Expected the "Password" field to show its value, but its type is "password".
    Given I am an anonymous user
    When I go to "/en/login"
    Then the "Password" field should show its value

  Scenario: A tags field is said to hold a tag it does not hold
    Fails with: Expected the "Tags" field to have the tags "ipsum". It shows "lorem" and sends "lorem".
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I add the tag "lorem" to the "Tags" field
    Then the "Tags" field should have the tags "ipsum"
