@back-office
Feature: The back office
  As an administrator of the blog
  I want to write, change and delete my posts
  So that the blog says what I mean, and only what I mean

  # Every post a scenario writes, the scenario deletes. A tag of the demo is used where a post needs
  # one: a new tag would stay on the app after the post is gone.

  @critical
  Scenario: The administrator's post list and its navigation
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/"
    Then I should see "Post List"
    And the navigation should have the item "Post list"
    And the navigation should have the item "Back to blog"
    And the navigation should show "Post list" as the current page

  Scenario: Only an administrator has the back office in the navigation
    Given I am a logged in user with the "administrator" user
    When I go to "/en/blog/"
    Then the navigation should have the item "Backend"
    And the navigation should show "Homepage" as the current page
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/"
    Then the navigation should not have the item "Backend"

  Scenario: An empty title is stopped by the browser
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I press "Create post"
    Then the "Title" field should block submission as required
    And I should be on "/en/admin/post/new"

  Scenario: A post the rules refuse comes back with the reason under each field
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the webship-js suite"
    And I fill in "Summary" with "A summary."
    And I fill in "Content" with "Too short"
    And I press "Create post"
    Then the response status code should be 422
    And the "Content" field should have the error "Post content is too short (10 characters minimum)"
    And the "Title" field should have no error
    And the "Summary" field should have no error

  Scenario: A title that another post already has is refused
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "Pellentesque vitae velit ex"
    And I fill in "Summary" with "A summary."
    And I fill in "Content" with "This post was written by the webship-js suite."
    And I press "Create post"
    Then the "Title" field should have the error "This title was already used in another blog post, but they must be unique."

  Scenario: A post is written, changed and deleted
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the webship-js suite"
    And I fill in "Summary" with "A post the suite writes and deletes again."
    And I fill in "Content" with "This post was written by the webship-js suite and is deleted again."
    And I add the tag "lorem" to the "Tags" field
    And I add the tag "ipsum" to the "Tags" field
    And I remove the tag "ipsum" from the "Tags" field
    Then the "Tags" field should have the tags "lorem"
    When I press "Create post"
    Then I should be on "/en/admin/post/"
    And I should see the success message "Post created successfully!"
    And I should see "A post of the webship-js suite" in the "A post of the webship-js suite" row
    When I go to "/en/blog/"
    Then I should see the post "A post of the webship-js suite"
    And the post "A post of the webship-js suite" should be written by "administrator"
    And the post "A post of the webship-js suite" should have the tag "lorem"
    And the post "A post of the webship-js suite" should not have the tag "ipsum"
    When I go to "/en/admin/post/"
    And I click "Edit" in the "A post of the webship-js suite" row
    And I fill in "Summary" with "A post the suite changed."
    And I add the tag "dolore" to the "Tags" field
    And I press "Save changes"
    Then I should see the success message "Post updated successfully!"
    And the "Tags" field should have the tags "lorem, dolore"
    When I close the message "Post updated successfully!"
    Then I should not see the success message "Post updated successfully!"
    When I click the "Delete post" button
    Then I should see the modal
    And I should see "Are you sure you want to delete this post?" in the modal
    When I click "Cancel" in the modal
    Then I should not see the modal
    When I click the "Delete post" button
    And I click "Delete post" in the modal
    Then I should be on "/en/admin/post/"
    And I should see the success message "Post deleted successfully!"
    And I should not see "A post of the webship-js suite"

  Scenario: A post dated in the future waits in the back office until its day
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A scheduled post of the webship-js suite"
    And I fill in "Summary" with "A post the suite schedules and deletes again."
    And I fill in "Content" with "This post was scheduled by the webship-js suite and is deleted again."
    And I set the "Published at" date to "2030-01-01 10:00"
    And I press "Create post"
    Then I should see the success message "Post created successfully!"
    And I should see "A scheduled post of the webship-js suite" in the "A scheduled post of the webship-js suite" row
    When I go to "/en/blog/"
    Then I should not see the post "A scheduled post of the webship-js suite"
    When I go to "/en/admin/post/"
    And I click "Edit" in the "A scheduled post of the webship-js suite" row
    And I click the "Delete post" button
    And I click "Delete post" in the modal
    Then I should see the success message "Post deleted successfully!"

  @js-off
  Scenario: The back office refuses an account that is not an administrator
    Given I am a logged in user with the "user" user
    When I go to "/en/admin/post/"
    Then I should see the 403 error page
    And the page should not show debug information

  Scenario: The back office sends a visitor to the login form
    Given I am an anonymous user
    When I go to "/en/admin/post/new"
    Then I should see the login form
