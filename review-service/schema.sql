CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS review_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  prohibit_self_approval boolean NOT NULL DEFAULT true,
  retention_days integer NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 30 AND 2555),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_members (
  team_id uuid NOT NULL REFERENCES review_teams(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('requester', 'reviewer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS review_requests (
  id text PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES review_teams(id) ON DELETE CASCADE,
  receipt jsonb NOT NULL,
  requester_id text NOT NULL,
  assigned_to text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  outcome text CHECK (outcome IN ('ALLOW', 'BLOCK')),
  rationale text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);

CREATE TABLE IF NOT EXISTS review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  request_id text NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_requests_team_created_idx ON review_requests(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_requests_assigned_idx ON review_requests(team_id, assigned_to, status);
CREATE INDEX IF NOT EXISTS review_events_request_idx ON review_events(request_id, created_at);
CREATE INDEX IF NOT EXISTS review_notifications_user_idx ON review_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
