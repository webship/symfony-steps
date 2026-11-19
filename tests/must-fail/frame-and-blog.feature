@must-fail
Feature: Assertions that must fail: the frame of the app and the blog
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.

  Scenario: The user menu is said to name the other account
    Fails with: Expected the user menu to name
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/"
    Then the user menu should name "administrator"

  Scenario: An item the user menu has is said to be missing
    Fails with: Expected the user menu not to offer "Account", but it does.
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/"
    Then the user menu should not offer "Account"

  Scenario: An item the user menu does not have is said to be there
    Fails with: Expected the user menu to offer "Backend". It offers:
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/"
    Then the user menu should offer "Backend"

  Scenario: An item the navigation does not have is said to be there
    Fails with: Expected the navigation to have the item "Backend". It has:
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the navigation should have the item "Backend"

  Scenario: An item the navigation has is said to be missing
    Fails with: Expected the navigation not to have the item "Search", but it does.
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the navigation should not have the item "Search"

  Scenario: Another item is said to be the current page
    Fails with: Expected the navigation to show "Search" as the current page. It shows "Homepage"
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the navigation should show "Search" as the current page

  Scenario: The current item is said not to be the current page
    Fails with: Expected the navigation not to show "Homepage" as the current page, but it does.
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the navigation should not show "Homepage" as the current page

  Scenario: A language the chooser does not have is said to be offered
    Fails with: Expected the language chooser to offer "Klingon". It offers:
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the language chooser should offer "Klingon"

  Scenario: A language the chooser has is said to be missing
    Fails with: Expected the language chooser not to offer "Deutsch", but it does.
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the language chooser should not offer "Deutsch"

  Scenario: Another language is said to be the current one
    Fails with: Expected the current language to be "Español". The chooser marks "English (en)" and the page says its language is "en".
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the current language should be "Español"

  Scenario: A page written from left to right is said to be written from right to left
    Fails with: Expected the page to be written from right to left, but its text runs ltr
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the page should be written from right to left

  Scenario: The list is said to hold fewer posts than it does
    Fails with: Expected the page to list 5 post(s), but it lists 10:
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the page should list 5 posts

  Scenario: A post the list does not have is said to be there
    Fails with: Expected to see the post "A post that is not there". The page lists:
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then I should see the post "A post that is not there"

  Scenario: A post the list has is said to be missing
    Fails with: Expected not to see the post "Pellentesque vitae velit ex", but the page lists it.
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then I should not see the post "Pellentesque vitae velit ex"

  Scenario: A post is said to be written by somebody who writes no posts
    Fails with: Expected the post "Pellentesque vitae velit ex" to be written by "John Doe", but its author line says
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the post "Pellentesque vitae velit ex" should be written by "John Doe"

  Scenario: A post is said not to be written by its author
    Fails with: Expected the post "Lorem ipsum dolor sit amet consectetur adipiscing elit" not to be written by "Jane Doe", but its author line says
    Given I am an anonymous user
    When I go to "/en/blog/posts/lorem-ipsum-dolor-sit-amet-consectetur-adipiscing-elit"
    Then the post "Lorem ipsum dolor sit amet consectetur adipiscing elit" should not be written by "Jane Doe"

  Scenario: A post is said to carry a tag the app does not have
    Fails with: Expected the post "Pellentesque vitae velit ex" to have the tag "no-such-tag". Its tags:
    Given I am an anonymous user
    When I go to "/en/blog/posts/pellentesque-vitae-velit-ex"
    Then the post "Pellentesque vitae velit ex" should have the tag "no-such-tag"

  Scenario: A post is said not to carry a tag it carries
    Fails with: Expected the post "A post of the must-fail run with a tag" not to have the tag "lorem", but it has.
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the must-fail run with a tag"
    And I fill in "Summary" with "A post the must-fail run writes; its cleanup deletes it."
    And I fill in "Content" with "This post was written by the must-fail run of the webship-js suite."
    And I add the tag "lorem" to the "Tags" field
    And I press "Create post"
    And I go to "/en/blog/posts/a-post-of-the-must-fail-run-with-a-tag"
    Then the post "A post of the must-fail run with a tag" should not have the tag "lorem"

  Scenario: The whole list is said to carry one tag
    Fails with: Expected every post to have the tag "lorem", but
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then every post should have the tag "lorem"

  Scenario: The first page of the list is said to be the second
    Fails with: Expected the list to be on page 2, but its pager marks "1" as the current page.
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the list should be on page 2

  Scenario: The list is said to have more pages than it has
    Fails with: Expected the list to have 9 page(s), but its pager has
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the list should have 9 pages

  Scenario: The second page is said to have no previous page
    Fails with: Expected the list to have no previous page, but its pager links
    Given I am an anonymous user
    When I go to "/en/blog/page/2"
    Then the list should have no previous page

  Scenario: A post is said to have more comments than it has
    Fails with: Expected the post to have 6 comment(s), but it shows 5.
    Given I am an anonymous user
    When I go to "/en/blog/posts/pellentesque-vitae-velit-ex"
    Then the post should have 6 comments

  Scenario: A comment nobody wrote is said to be there
    Fails with: Expected the comment "A comment that is not there." by "John Doe". The post shows:
    Given I am an anonymous user
    When I go to "/en/blog/posts/pellentesque-vitae-velit-ex"
    Then I should see the comment "A comment that is not there." by "John Doe"

  Scenario: A comment on the post is said to be gone
    Fails with: Expected no comment "A comment of the must-fail run." by
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/new"
    And I fill in "Title" with "A post of the must-fail run with a comment"
    And I fill in "Summary" with "A post the must-fail run writes; its cleanup deletes it."
    And I fill in "Content" with "This post was written by the must-fail run of the webship-js suite."
    And I press "Create post"
    Given I am a logged in user with the "user" user
    When I go to "/en/blog/posts/a-post-of-the-must-fail-run-with-a-comment"
    And I publish the comment "A comment of the must-fail run."
    Then I should not see the comment "A comment of the must-fail run." by "user"
