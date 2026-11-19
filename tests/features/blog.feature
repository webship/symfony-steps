@blog
Feature: The blog
  As a reader of the blog
  I want to read the posts, page through them, filter them by a tag and find one
  So that I get to what I came for

  # The posts are the demo's own (its fixtures): 30 posts, newest first, one a day. Their authors and
  # their tags are drawn at random when the data is loaded, so a scenario asserts them only through
  # what it sees on the page. The newest one is published at a random hour of the day the data was
  # loaded and may not be out yet: the scenarios start from the second, "Pellentesque vitae velit ex".

  @critical
  Scenario: The blog lists the newest posts, ten to a page
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the response status code should be 200
    And the page should list 10 posts
    And I should see the post "Pellentesque vitae velit ex"
    And the post "Pellentesque vitae velit ex" should not be written by "user"

  Scenario: A post opens on its own page, with its comments
    Given I am an anonymous user
    When I go to "/en/blog/"
    And I open the post "Pellentesque vitae velit ex"
    Then the post "Pellentesque vitae velit ex" should not be written by "John Doe"
    And the post should have 5 comments
    And I should see "to publish a comment"

  Scenario: The pager walks through the three pages of the list
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the list should have 3 pages
    And the list should be on page 1
    And the list should have no previous page
    When I go to the next page of the list
    Then the list should be on page 2
    And the page should list 10 posts
    And I should not see the post "Pellentesque vitae velit ex"
    When I go to page 3 of the list
    Then the list should be on page 3
    And the list should have no next page
    And I should see the post "Bassus fatalis classiss virtualiter transferre de flavum"
    When I go to the previous page of the list
    Then the list should be on page 2

  Scenario: A tag filters the list down to the posts that carry it
    Given I am an anonymous user
    When I go to "/en/blog/"
    And I filter the posts by the tag "lorem"
    Then every post should have the tag "lorem"
    And current url should have the "tag" parameter with the "lorem" value

  Scenario: A link of an older page of the list keeps the filter
    Given I am an anonymous user
    When I go to "/en/blog/?tag=ipsum"
    Then every post should have the tag "ipsum"

  Scenario: The search lists the posts whose title holds the words, while the reader types
    Given I am an anonymous user
    When I go to "/en/blog/search"
    And I type "vulputate" in the "Search for..." field
    Then the page should list 3 posts
    And I should see the post "Mauris dapibus risus quis suscipit vulputate"
    And I should see the post "Eros diam egestas libero eu vulputate risus"
    And I should see the post "Ut suscipit posuere justo at vulputate"
    When I type "barbatus" in the "Search for..." field
    Then the page should list 1 post
    And I should see the post "Ubi est barbatus nix"

  Scenario: A search that finds nothing says so
    Given I am an anonymous user
    When I go to "/en/blog/search"
    And I type "xylophone" in the "Search for..." field
    Then the page should list 0 posts
    And I should see "No results found"

  Scenario: The feed of the blog lists the newest posts
    Given I am an anonymous user
    When I go to "/en/blog/rss.xml"
    Then the response status code should be 200
    And the response header "content-type" should contain the value "xml"
    And I should see "Pellentesque vitae velit ex"
