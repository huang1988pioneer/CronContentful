const CONTENT_TYPE = "croncontentful";
const TIME_ZONE = process.env.CRON_TIME_ZONE || "Asia/Taipei";
const DEFAULT_ENVIRONMENT_ID = "master";
const DEFAULT_LOCALE = "en-US";

const spaceId = requireEnv("CONTENTFUL_SPACE_ID");
const managementToken = requireEnv("CONTENTFUL_MANAGEMENT_TOKEN");
const environmentId = process.env.CONTENTFUL_ENVIRONMENT_ID || DEFAULT_ENVIRONMENT_ID;
const locale = process.env.CONTENTFUL_LOCALE || DEFAULT_LOCALE;
const requestedAction = process.env.CRON_ACTION || process.argv[2] || "auto";
const deleteTarget = process.env.CRON_DELETE_TARGET || "latest";

const now = new Date();
const localParts = getLocalParts(now, TIME_ZONE);
const action = resolveAction(requestedAction, localParts);

console.log(
  `CronContentful run: action=${action}, local=${localParts.isoLike}, timezone=${TIME_ZONE}`
);

if (action === "start") {
  console.log("Daily 05:05 start check completed. No Contentful entry was changed.");
} else if (action === "add") {
  // 奇數小時 :33 新增一筆資料
  const entry = await createCronContentfulEntry(now, localParts);
  await publishEntry(entry);
  console.log(`Created and published ${CONTENT_TYPE} entry: ${entry.sys.id}`);
} else if (action === "read") {
  // 奇數小時 :37 讀取一筆資料
  const entry = await readLatestCronContentfulEntry();
  if (!entry) {
    console.log(`No ${CONTENT_TYPE} entries found. Nothing to read.`);
  } else {
    console.log(`Read latest ${CONTENT_TYPE} entry: ${entry.sys.id}`);
    console.log(`  name: ${entry.fields?.name?.[locale]}`);
    console.log(`  lastRunAt: ${entry.fields?.lastRunAt?.[locale]}`);
    console.log(`  lastStatus: ${entry.fields?.lastStatus?.[locale]}`);
  }
} else if (action === "update") {
  // 偶數小時 :33 更新一筆資料
  const entry = await findLatestCronContentfulEntry();
  if (!entry) {
    console.log(`No ${CONTENT_TYPE} entries found. Nothing to update.`);
  } else {
    const updated = await updateCronContentfulEntry(entry, now, localParts);
    await publishEntry(updated);
    console.log(`Updated and published ${CONTENT_TYPE} entry: ${updated.sys.id}`);
  }
} else if (action === "delete") {
  // 偶數小時 :37 刪除一筆資料
  const entry = await findCronContentfulEntryToDelete(deleteTarget);

  if (!entry) {
    console.log(`No ${CONTENT_TYPE} entries found. Nothing to delete.`);
  } else {
    await deleteEntry(entry);
    console.log(`Deleted ${deleteTarget} ${CONTENT_TYPE} entry: ${entry.sys.id}`);
  }
} else {
  throw new Error(`Unsupported CRON_ACTION: ${action}`);
}

function resolveAction(value, parts) {
  if (["add", "read", "update", "delete", "start"].includes(value)) {
    return value;
  }

  if (value !== "auto") {
    throw new Error("CRON_ACTION must be auto, start, add, read, update, or delete.");
  }

  if (parts.hour === 5 && parts.minute === 5) {
    return "start";
  }

  // 奇數小時 :33 新增，奇數小時 :37 讀取
  // 偶數小時 :33 更新，偶數小時 :37 刪除
  if (parts.minute === 33) {
    return parts.hour % 2 === 1 ? "add" : "update";
  }

  if (parts.minute === 37) {
    return parts.hour % 2 === 1 ? "read" : "delete";
  }

  return "start";
}

async function createCronContentfulEntry(timestamp, parts) {
  const runUrl = getRunUrl();
  const body = {
    fields: {
      name: field(`CronContentful ${parts.isoLike}`),
      targetUrl: field(runUrl),
      method: field("POST"),
      schedule: field("odd hour :33 add"),
      contentType: field(CONTENT_TYPE),
      locale: field(locale),
      enabled: field(true),
      lastStatus: field("created"),
      lastRunAt: field(timestamp.toISOString()),
      lastSuccessAt: field(timestamp.toISOString()),
      note: field(`Created by GitHub Actions at ${parts.isoLike} ${TIME_ZONE}.`)
    }
  };

  return contentfulRequest(`/entries`, {
    method: "POST",
    headers: {
      "X-Contentful-Content-Type": CONTENT_TYPE
    },
    body
  });
}

async function readLatestCronContentfulEntry() {
  const response = await contentfulRequest(
    `/entries?content_type=${CONTENT_TYPE}&order=${encodeURIComponent("-sys.createdAt")}&limit=1`
  );
  return response.items?.[0] || null;
}

async function findLatestCronContentfulEntry() {
  const response = await contentfulRequest(
    `/entries?content_type=${CONTENT_TYPE}&order=${encodeURIComponent("-sys.createdAt")}&limit=1`
  );
  return response.items?.[0] || null;
}

async function updateCronContentfulEntry(entry, timestamp, parts) {
  const runUrl = getRunUrl();
  const updatedFields = {
    ...entry.fields,
    schedule: field("even hour :33 update"),
    lastStatus: field("updated"),
    lastRunAt: field(timestamp.toISOString()),
    lastSuccessAt: field(timestamp.toISOString()),
    note: field(`Updated by GitHub Actions at ${parts.isoLike} ${TIME_ZONE}.`),
    targetUrl: field(runUrl)
  };

  return contentfulRequest(`/entries/${entry.sys.id}`, {
    method: "PUT",
    headers: {
      "X-Contentful-Version": String(entry.sys.version)
    },
    body: { fields: updatedFields }
  });
}

async function findCronContentfulEntryToDelete(target) {
  if (!["latest", "oldest"].includes(target)) {
    throw new Error("CRON_DELETE_TARGET must be latest or oldest.");
  }

  const order = target === "latest" ? "-sys.createdAt" : "sys.createdAt";
  const response = await contentfulRequest(
    `/entries?content_type=${CONTENT_TYPE}&order=${encodeURIComponent(order)}&limit=1`
  );
  return response.items?.[0] || null;
}

async function publishEntry(entry) {
  return contentfulRequest(`/entries/${entry.sys.id}/published`, {
    method: "PUT",
    headers: {
      "X-Contentful-Version": String(entry.sys.version)
    },
    body: entry
  });
}

async function deleteEntry(entry) {
  let current = entry;

  if (current.sys.publishedVersion) {
    const unpublished = await contentfulRequest(`/entries/${current.sys.id}/published`, {
      method: "DELETE",
      headers: {
        "X-Contentful-Version": String(current.sys.version)
      }
    });
    current = unpublished || (await contentfulRequest(`/entries/${current.sys.id}`));
  }

  await contentfulRequest(`/entries/${current.sys.id}`, {
    method: "DELETE",
    headers: {
      "X-Contentful-Version": String(current.sys.version)
    }
  });
}

async function contentfulRequest(path, options = {}) {
  const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}${path}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${managementToken}`,
      "Content-Type": "application/vnd.contentful.management.v1+json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.details?.errors?.[0]?.details || text;
    throw new Error(`Contentful API ${response.status} ${response.statusText}: ${message}`);
  }

  return data;
}

function field(value) {
  return { [locale]: value };
}

function getRunUrl() {
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;

  if (repository && runId) {
    return `https://github.com/${repository}/actions/runs/${runId}`;
  }

  return "https://github.com/huang1988pioneer/CronContentful";
}

function getLocalParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    isoLike: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
  };
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}
