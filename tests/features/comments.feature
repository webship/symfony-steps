@comments
Feature: Comments
  As a reader with an account
  I want to comment on a post, and its author to hear of it
  So that the post becomes a conversation

  # A comment cannot be deleted in the app, so the scenarios comment on a post they write first and
  # delete afterwards: the comments go with it.

  Scenario: A reader comments, the author is told by mail, and the comment is on the post
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the webship-js suite to comment on"
    And I fill in "Summary" with "A post the suite comments on and deletes again."
    And I fill in "Content" with "This post was written by the webship-js suite and is deleted again."
    And I press "Create post"
    Then I should see the success message "Post created successfully!"
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/"
    And I open the post "A post of the webship-js suite to comment on"
    Then the post should have 0 comments
    And I should see "Be the first to comment on this post."
    When I publish the comment "A comment of the webship-js suite."
    Then I should be on "/en/blog/posts/a-post-of-the-webship-js-suite-to-comment-on"
    And the post should have 1 comment
    And I should see the comment "A comment of the webship-js suite." by "user"
    And I should not see the comment "A comment of the webship-js suite." by "administrator"
    And an email with the subject "Your post received a comment!" should be sent to "administrator"
    And the email with the subject "Your post received a comment!" to "administrator" should contain "A post of the webship-js suite to comment on"
    And no email should be sent to "user"
    When I open the "this link" link of the email to "administrator"
    Then I should see the comment "A comment of the webship-js suite." by "user"
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/"
    And I click "Edit" in the "A post of the webship-js suite to comment on" row
    And I click the "Delete post" button
    And I click "Delete post" in the modal
    Then I should see the success message "Post deleted successfully!"

  Scenario: A comment that is too short comes back with the reason
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/posts/pellentesque-vitae-velit-ex"
    And I publish the comment "abc"
    Then the response status code should be 422
    And I should see "There was an error publishing your comment"
    And the "Content" field should have the error "Comment is too short (5 characters minimum)"

  Scenario: An empty comment is stopped by the browser
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/posts/pellentesque-vitae-velit-ex"
    And I press "Publish comment"
    Then the "Content" field should block submission as required
    And the post should have 5 comments

  Scenario: A visitor is asked to sign in to comment, and comes back to the post
    Given I am an anonymous user
    When I go to "/en/blog/posts/pellentesque-vitae-velit-ex"
    Then I should see "to publish a comment"
    When I follow "Sign in"
    And I fill in "Username" with the username of "user"
    And I fill in "Password" with the password of "user"
    And I press "Sign in"
    Then I should be on "/en/blog/posts/pellentesque-vitae-velit-ex"
    And I should be logged in as "user"
    And I should see "Add a comment"
