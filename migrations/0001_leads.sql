CREATE TABLE IF NOT EXISTS leads (
 id TEXT PRIMARY KEY, category TEXT NOT NULL CHECK(category IN ('tester','launch')),
 email TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '', data TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'New', consent INTEGER NOT NULL, consent_at TEXT,
 created_at TEXT NOT NULL, source TEXT NOT NULL, duplicate_count INTEGER NOT NULL DEFAULT 0,
 UNIQUE(category,email)
);
CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
