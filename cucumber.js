// A feature file, a scenario (file:line), a folder or a rerun file named on
// the command line of cucumber-js runs alone: `npx cucumber-js
// tests/features/session.feature`. cucumber-js 12 adds the paths of the
// command line to the `paths` of this file instead of using them alone, so
// `paths` is left empty when the command line names any, as in webship-js.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  // Only when cucumber-js itself runs, not when another script reads this file.
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

// The default is the local DDEV app that .github/scripts/build-ddev-site.sh
// builds (project "symfonysteps"), never an app of somebody else: the suite
// logs in with the accounts below. LAUNCH_URL points it at another app.
const launchUrl = process.env.LAUNCH_URL || 'https://symfonysteps.ddev.site';

module.exports = {
  default: {
    // The step timeout is webship-js's (45 s, set when it loads): WEBSHIP_STEP_TIMEOUT=<milliseconds> changes it; a `timeout` key here is ignored.
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions (auto HTML report on exit; disable: WEBSHIP_REPORT_DISABLE=1).
      'tests/step-definitions/**/*.js',                                  // The step definitions of this pack.
    ],
    // FEATURES=tests/features/a.feature,tests/features/b.feature runs a subset too.
    paths: process.env.FEATURES ? process.env.FEATURES.split(',') : (commandLinePaths().length ? [] : ['tests/features/**/*.feature']),
    // CUCUMBER_TAGS=@critical runs a lane. The default leaves out work in progress, the assertions that
    // must fail (tests/check-must-fail.js runs them), and the lane that needs the app in the dev
    // environment (@dev-mode: APP_ENV=dev, the debug toolbar and the profiler).
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail and not @dev-mode',
    format: [
      '@cucumber/pretty-formatter',
      // REPORT_NAME=must-fail keeps the report of another run (tests/check-must-fail.js) apart.
      `json:tests/reports/${process.env.REPORT_NAME || 'cucumber_report'}.json`,
    ],
    formatOptions: {
      // Colours follow the terminal (GitHub Actions counts as one); FORCE_COLOR=1
      // or FORCE_COLOR=0 sets them. cucumber-js 12 deprecated `colorsEnabled`.
      theme: {
        'feature keyword': ['bold', 'blue'],
        'feature name': ['blue', 'underline'],
        'feature description': ['blueBright'],
        'scenario keyword': ['bold', 'magenta'],
        'scenario name': ['magenta', 'underline'],
        'step keyword': ['bold', 'green'],
        'step text': ['greenBright', 'italic'],
      },
    },
    worldParameters: {
      launchUrl,
      // The page the login step sends an account to, the login page, and a page only a signed-in
      // account may open (the steps that ask who is logged in open it).
      homePath: process.env.HOME_PATH || '/en/blog/',
      loginPath: process.env.LOGIN_PATH || '/en/login',
      accountPath: process.env.ACCOUNT_PATH || '/en/profile/edit',
      // The mailbox that catches the mail of the app (the mail steps read it): the Mailpit of the DDEV project.
      mailUrl: process.env.MAIL_URL || launchUrl.replace(/\/+$/, '') + ':8026',
      // An account that logged in once keeps its session for the rest of the run: later scenarios take it
      // over instead of filling in the login form again.
      reuseSessions: process.env.REUSE_SESSIONS !== 'false',
      // Video of the browser: 'off', 'on', 'on-failure' or 'tag' (scenarios tagged @video; @no-video opts out).
      video: { mode: process.env.WEBSHIP_VIDEO || 'off', dir: './videos', size: { width: 1280, height: 720 }, filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}' },
      // JavaScript errors the page raises: 'warn' reports them, 'fail' fails the scenario, 'off' ignores them;
      // @js-fail, @js-warn and @js-off per scenario. Not a fault of the app, so left out: the browser logs
      // "Failed to load resource: the server responded with a status of 422" for every form the app refuses
      // (422 is the status of a form with errors). The scenarios that open an error page carry @js-off: the
      // browser logs the same line with its 4xx or 5xx status.
      javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'warn', levels: ['error'], ignore: 'the server responded with a status of 422', beforeScenario: false, afterScenario: true },
      // The accounts that "I am a logged in user with the ... user" uses, by handle. They are configuration,
      // not test data: the demo's fixtures create them (.github/scripts/build-ddev-site.sh) and a feature
      // never creates or deletes users. Point the suite at another app with the *_USERNAME, *_PASSWORD,
      // *_NAME and *_EMAIL variables.
      users: {
        // ROLE_ADMIN: the back office; the author of the newest post of the demo.
        administrator: {
          username: process.env.ADMINISTRATOR_USERNAME || 'jane_admin',
          password: process.env.ADMINISTRATOR_PASSWORD || 'kitten',
          name: process.env.ADMINISTRATOR_NAME || 'Jane Doe',
          email: process.env.ADMINISTRATOR_EMAIL || 'jane_admin@example.com',
        },
        // ROLE_USER: comments, the profile; refused in the back office.
        user: {
          username: process.env.USER_USERNAME || 'john_user',
          password: process.env.USER_PASSWORD || 'kitten',
          name: process.env.USER_NAME || 'John Doe',
          email: process.env.USER_EMAIL || 'john_user@example.com',
        },
      },
      minWaitTime: {
        page: 3000,
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },
      selectors: {
        css: {},
        xpath: {},
        filesPath: './tests/selectors/',
        files: [],
        offset: 60,
        breakpoints: {
          xs:   { width: 375,  height: 667  },
          sm:   { width: 576,  height: 800  },
          md:   { width: 768,  height: 1024 },
          lg:   { width: 992,  height: 768  },
          xl:   { width: 1200, height: 900, default: true },
          xxl:  { width: 1400, height: 900  },
          xxxl: { width: 1920, height: 1080 },
        },
      },
      screenshot: {
        dir: './screenshots',
        purge: false,
        onFailed: true,
        onEveryStep: false,
        alwaysFullscreen: false,
        failedPrefix: 'failed_',
        filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
        filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}',
        infoTypes: '',
      },
    },
  },
};
