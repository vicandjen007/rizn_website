CREATE TABLE IF NOT EXISTS email_outbox (
 id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id), kind TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0, first_attempt INTEGER,
 payload TEXT, provider_id TEXT, last_error TEXT
);
CREATE INDEX IF NOT EXISTS email_due ON email_outbox(state,next_attempt);
CREATE TRIGGER IF NOT EXISTS queue_lead_emails AFTER INSERT ON leads BEGIN
 INSERT INTO email_outbox(id,lead_id,kind) VALUES (NEW.id||'-confirmation',NEW.id,'confirmation');
 INSERT INTO email_outbox(id,lead_id,kind) VALUES (NEW.id||'-notification',NEW.id,'notification');
END;
