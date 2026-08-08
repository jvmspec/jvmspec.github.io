Feature: Present JavaSpec on its GitHub Pages home
  The project site is the trustworthy, fast entry point for Java developers
  who want to understand JavaSpec and try the published release candidate.

  Background:
    Given JavaSpec 1.0.0-RC5 is published to Maven Central
    And Gradle Plugin Portal marker availability has not been verified

  Scenario: Understand the product from the first viewport
    When a visitor opens the home page
    Then the page explains that JavaSpec is a spec-first BDD tool for Java
    And it identifies the Java 8-compatible zero-runtime-dependency core
    And it offers clear actions to get started, read the documentation, and view the source

  Scenario: Follow the behavior-first feedback loop
    When a visitor explores the workflow
    Then the site presents Spec, RED, Generate, GREEN, and Refactor as one feedback loop
    And generated production stubs are described as scaffolding rather than domain logic

  Scenario: Copy accurate RC5 onboarding
    When a visitor opens the installation section
    Then the Maven coordinate is io.github.jvmspec:javaspec:1.0.0-RC5
    And the dependency snippet can be copied with a keyboard-operable control
    And the site links to the published Maven Central artifact
    And Gradle submission is described separately from public marker availability

  Scenario: Explore the supported ecosystem
    When a visitor reviews capabilities
    Then the page distinguishes the dependency-free core from optional adapters
    And CLI, Maven, Gradle, JUnit Platform, ByteBuddy doubles, and bytecode-agent integrations are represented
    And no unsupported adoption, performance, or stable-release claim is shown

  Scenario: Distinguish the post-RC5 native executable preview
    When a visitor reviews development capabilities
    Then the site explains that Maven links project classes into a project-specific executable
    And it identifies GraalVM Native Image 25 as a build-time requirement
    And it does not attribute native-prepare to published RC5
    And it links to the source-current native guide

  Scenario: Reach documentation in a preferred language
    When a visitor opens the documentation section
    Then English, Italian, Spanish, German, French, and Simplified Chinese manuals are linked
    And release notes and the source repository are linked

  Scenario: Use the site accessibly on mobile or desktop
    When the page is used at representative mobile and desktop widths
    Then semantic landmarks and a skip link are available
    And keyboard focus is visible
    And reduced-motion preferences are respected
    And there is no horizontal page overflow
    And critical content remains available without JavaScript
