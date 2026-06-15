# CronContentful

GitHub Actions workflow for the `croncontentful` Contentful table used by
`huang1988pioneer/ContentfulFengBroAI`.

## Schedule

Times are interpreted in `Asia/Taipei`.

- Every day at 05:05: start check, no Contentful entry is changed.
- Odd hours at :33 from 05:33 through 23:33: create and publish one
  `croncontentful` entry.
- Even hours at :33 from 06:33 through 22:33: delete one
  `croncontentful` entry.

GitHub Actions cron runs in UTC, so the workflow converts the runtime back to
`Asia/Taipei` before deciding whether to add or delete.

## Required GitHub Secrets

- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_MANAGEMENT_TOKEN`

Optional secrets:

- `CONTENTFUL_ENVIRONMENT_ID`, defaults to `master`
- `CONTENTFUL_LOCALE`, defaults to `en-US`

The target Contentful content type is `croncontentful`, matching the
`Cron Contentful` table schema from `ContentfulFengBroAI`.

## Manual Run

Open the `Cron Contentful` GitHub Actions workflow and choose `Run workflow`.
The default manual action is `add`, so running it without changing inputs
creates and publishes one `croncontentful` entry.

- `action=add`: manually create and publish one entry.
- `action=delete`: manually delete one entry. `delete_target=latest` deletes the
  most recently created entry, and is the default.
