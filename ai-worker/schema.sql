CREATE TABLE IF NOT EXISTS ai_requests (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL DEFAULT '',
 summary TEXT NOT NULL,
 transcript TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ახალი',
 message_count INTEGER NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ai_requests_created ON ai_requests(created_at DESC);
CREATE TABLE IF NOT EXISTS chat_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
