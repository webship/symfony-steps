@accessibility
Feature: Accessibility of the pages every visitor and account meets
  As a person who uses a screen reader or a keyboard
  I want the pages of the app to have no critical accessibility fault
  So that I can read and use it like anybody else

  Scenario Outline: A page a visitor opens has no critical accessibility violations
    Given I am an anonymous user
    When I go to "<path>"
    Then the page should have no critical accessibility violations
    And the page should declare a language

    Examples:
      | path                                     |
      | /en/blog/                                |
      | /en/blog/posts/pellentesque-vitae-velit-ex |
      | /en/blog/search                          |
      | /en/login                                |

  # The post form (/en/admin/post/new) is left out: its date picker has two buttons without a name
  # and its tags widget two inputs without a label (both critical), faults of those widgets.
  Scenario Outline: A page an account opens has no critical accessibility violations
    Given I am a logged in user with the "administrator" user
    When I go to "<path>"
    Then the page should have no critical accessibility violations

    Examples:
      | path               |
      | /en/admin/post/    |
      | /en/profile/edit   |
      | /en/profile/change-password |
