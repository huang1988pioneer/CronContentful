# CronContentful

GitHub Actions workflow for the `croncontentful` Contentful table used by
`huang1988pioneer/ContentfulFengBroAI`.

## Schedule

Times are interpreted in `Asia/Taipei`.

- Every day at 05:05: start check, no Contentful entry is changed.
- Odd hours at :33: create and publish one `croncontentful` entry.
- Even hours at :33: delete the oldest `croncontentful` entry.

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
