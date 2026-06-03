ALTER TABLE scores ADD COLUMN discarded_at TEXT;
ALTER TABLE scores ADD COLUMN discard_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_scores_effective_candidate_role
  ON scores (candidate_id, role, discarded_at);

CREATE INDEX IF NOT EXISTS idx_scores_effective_binding
  ON scores (binding_id, discarded_at);
