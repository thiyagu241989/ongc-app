-- Well Information Management Platform
-- Target database: WellInformationDB
-- Project writer: Node.js Kafka consumer only

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE projects (
    project_id uuid PRIMARY KEY,
    project_code varchar(50) NOT NULL,
    project_name varchar(200) NOT NULL,
    well_name varchar(200) NOT NULL,
    operator_name varchar(200),
    field_name varchar(200),
    basin varchar(150),
    location varchar(300),
    status varchar(30) NOT NULL,
    description text,
    planned_start_date date,
    planned_end_date date,
    latitude numeric(9, 6),
    longitude numeric(9, 6),
    aggregate_version bigint NOT NULL,
    source_event_id uuid NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,
    event_occurred_at timestamptz NOT NULL,
    stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_projects_project_code UNIQUE (project_code),
    CONSTRAINT uq_projects_source_event UNIQUE (source_event_id),
    CONSTRAINT ck_projects_code_not_blank CHECK (btrim(project_code) <> ''),
    CONSTRAINT ck_projects_name_not_blank CHECK (btrim(project_name) <> ''),
    CONSTRAINT ck_projects_well_name_not_blank CHECK (btrim(well_name) <> ''),
    CONSTRAINT ck_projects_status CHECK (
        status IN ('Draft', 'Active', 'OnHold', 'Completed', 'Cancelled')
    ),
    CONSTRAINT ck_projects_date_range CHECK (
        planned_end_date IS NULL
        OR planned_start_date IS NULL
        OR planned_end_date >= planned_start_date
    ),
    CONSTRAINT ck_projects_latitude CHECK (
        latitude IS NULL OR latitude BETWEEN -90 AND 90
    ),
    CONSTRAINT ck_projects_longitude CHECK (
        longitude IS NULL OR longitude BETWEEN -180 AND 180
    ),
    CONSTRAINT ck_projects_aggregate_version CHECK (aggregate_version >= 1),
    CONSTRAINT ck_projects_deleted_at CHECK (
        (is_deleted AND deleted_at IS NOT NULL)
        OR (NOT is_deleted AND deleted_at IS NULL)
    )
);

CREATE INDEX ix_projects_active_updated_at
    ON projects (updated_at DESC)
    WHERE NOT is_deleted;

CREATE INDEX ix_projects_active_status_updated_at
    ON projects (status, updated_at DESC)
    WHERE NOT is_deleted;

CREATE INDEX ix_projects_project_name_search
    ON projects USING gin (project_name gin_trgm_ops)
    WHERE NOT is_deleted;

CREATE INDEX ix_projects_well_name_search
    ON projects USING gin (well_name gin_trgm_ops)
    WHERE NOT is_deleted;

CREATE TABLE kafka_consumer_logs (
    consumer_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_name varchar(200) NOT NULL,
    consumer_group varchar(200) NOT NULL,
    event_id uuid,
    event_type varchar(150),
    aggregate_id uuid,
    aggregate_version bigint,
    topic varchar(255) NOT NULL,
    partition_id integer NOT NULL,
    offset_value bigint NOT NULL,
    message_key varchar(255),
    status varchar(30) NOT NULL DEFAULT 'Processing',
    attempt_count integer NOT NULL DEFAULT 1,
    error_class varchar(200),
    error_details text,
    received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    processed_at timestamptz,
    CONSTRAINT uq_kafka_consumer_position UNIQUE (
        consumer_name,
        topic,
        partition_id,
        offset_value
    ),
    CONSTRAINT ck_kafka_consumer_partition CHECK (partition_id >= 0),
    CONSTRAINT ck_kafka_consumer_offset CHECK (offset_value >= 0),
    CONSTRAINT ck_kafka_consumer_aggregate_version CHECK (
        aggregate_version IS NULL OR aggregate_version >= 1
    ),
    CONSTRAINT ck_kafka_consumer_status CHECK (
        status IN ('Processing', 'Processed', 'IgnoredStale', 'DeadLettered')
    ),
    CONSTRAINT ck_kafka_consumer_attempt_count CHECK (attempt_count >= 1),
    CONSTRAINT ck_kafka_consumer_processed_at CHECK (
        (status = 'Processing' AND processed_at IS NULL)
        OR (status <> 'Processing' AND processed_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_kafka_consumer_event
    ON kafka_consumer_logs (consumer_name, event_id)
    WHERE event_id IS NOT NULL;

CREATE INDEX ix_kafka_consumer_logs_aggregate
    ON kafka_consumer_logs (aggregate_id, aggregate_version)
    WHERE aggregate_id IS NOT NULL;

COMMENT ON TABLE projects IS
    'Project data written only by the Node.js Kafka consumer.';

COMMENT ON TABLE kafka_consumer_logs IS
    'Node.js consumer idempotency and processing outcomes.';

COMMIT;