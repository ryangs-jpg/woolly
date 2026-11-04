CREATE TABLE user_state (
  user_id TEXT PRIMARY KEY NOT NULL,
  payload_json TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE search_cache (
  query_key TEXT PRIMARY KEY NOT NULL,
  payload_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX search_cache_expiry ON search_cache (expires_at);
