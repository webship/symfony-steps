@language
Feature: The language of the app
  As a reader who prefers another language
  I want to choose it from any page and stay on the page I was on
  So that I read the app in my language

  @critical
  Scenario: The language chooser offers the languages of the app, the current one marked
    Given I am an anonymous user
    When I go to "/en/blog/"
    Then the language chooser should offer "Español"
    And the language chooser should offer "Deutsch"
    And the language chooser should offer "ja"
    And the language chooser should not offer "Klingon"
    And the current language should be "English"
    And the page language should be "en"

  Scenario: Another language keeps the page and translates it
    Given I am an anonymous user
    When I go to "/en/blog/search"
    And I choose the language "Español"
    Then I should be on "/es/blog/search"
    And the current language should be "Español"
    And the navigation should have the item "Buscar"
    And the navigation should show "Buscar" as the current page
    And the page should be written from left to right
    When I choose the language "English"
    Then I should be on "/en/blog/search"
    And the navigation should have the item "Search"

  Scenario: A language written from right to left turns the page around
    Given I am an anonymous user
    When I go to "/en/blog/"
    And I choose the language "العربية"
    Then the page language should be "ar"
    And the page should be written from right to left
    When I choose the language "en"
    Then the page should be written from left to right

  Scenario: The back office follows the language too
    Given I am a logged in user with the "administrator" user
    When I go to "/en/admin/post/"
    And I choose the language "Deutsch"
    Then I should be on "/de/admin/post/"
    And the current language should be "Deutsch"
    And the user menu should name "administrator"
