#!/usr/bin/env bash
# Builds the app the suite runs against: the official Symfony Demo application,
# made with Composer (`composer create-project symfony/symfony-demo`) in a DDEV
# project of type symfony, with the demo's own data and its own accounts.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME   the DDEV project name                         (default symfonysteps)
#   SITE_DIR       the project folder                            (default a new temporary folder)
#   DEMO_VERSION   the release of the demo to make the app from  (default 3.1.0: Symfony 8.1;
#                  2.9.0 is the last release on Symfony 7.4, the long-term-support line)
#   PHP_VERSION    the PHP of the web container                  (default 8.4)
#   FIXTURES_ONLY  1: build nothing, load the demo's data again into the app in SITE_DIR (after a
#                  run that was stopped half way)
#
# The accounts are configuration: the demo's fixtures create them and cucumber.js names them; the
# features never create or delete users.
#   administrator  jane_admin, Jane Doe, password kitten   ROLE_ADMIN, the author of the newest post
#   user           john_user, John Doe, password kitten    ROLE_USER, the author of every comment
#
# Nothing is installed that the demo does not bring: no paid package, no trial, no sign-in to any
# service.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-symfonysteps}"
DEMO_VERSION="${DEMO_VERSION:-3.1.0}"
PHP_VERSION="${PHP_VERSION:-8.4}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"

# The demo's data, loaded the way its own login page tells a person to: the schema, then its
# fixtures (30 posts, their tags and comments, and the users jane_admin, tom_admin and john_user).
# The fixtures come with the demo's development tools, so they load in the dev environment, also
# once the app runs as a live app.
# The addresses of its users move to example.com, so no mail of the app is addressed to a real
# domain (the mail catcher of the project receives it either way).
load_demo_data() {
  ddev exec bin/console doctrine:schema:drop --force --full-database --quiet
  ddev exec bin/console doctrine:schema:create --quiet
  ddev exec bin/console doctrine:fixtures:load --env=dev --no-interaction
  ddev exec "bin/console dbal:run-sql \"UPDATE symfony_demo_user SET email = REPLACE(email, '@symfony.com', '@example.com')\"" > /dev/null
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${FIXTURES_ONLY:-}" = "1" ]; then
  load_demo_data
  exit 0
fi

# Node.js 24, the line the workspace builds run.
ddev config --project-type=symfony --docroot=public --project-name="$PROJECT_NAME" --php-version="$PHP_VERSION" --nodejs-version=24
ddev start -y

ddev composer create-project "symfony/symfony-demo:${DEMO_VERSION}" --no-interaction

# DDEV writes the database (MariaDB) and the mailer (its mail catcher) of the project into
# .env.local; the demo's data goes into that database.
load_demo_data

# The one page the test app adds to the demo: an error nothing catches, which the server error
# page scenarios open. Everything else is the demo's.
cp "$REPO_DIR/site/TestFixturesController.php" src/Controller/TestFixturesController.php

# A test app behaves like a live one: an error renders the error page, never the debug page, and
# there is no debug toolbar. The assets are compiled, as a live app serves them.
ddev dotenv set .env.local --app-env=prod --app-debug=0 > /dev/null
ddev exec bin/console asset-map:compile --quiet
ddev exec bin/console cache:clear --quiet

SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
FRAMEWORK="$(ddev exec bin/console --version 2>/dev/null | head -n 1 || true)"
echo "Built the demo ${DEMO_VERSION} (${FRAMEWORK:-unknown version}) at $SITE_URL"
