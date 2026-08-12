-- ONGC Insight Dashboard: Wellbore Design Milestone Tracking
-- Writer: Node.js Kafka consumer only (same as projects)

BEGIN;

CREATE TABLE wellbore_designs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company varchar(100) NOT NULL,
    project varchar(100) NOT NULL,
    site varchar(100) NOT NULL,
    well varchar(100) NOT NULL,
    wellbore varchar(100) NOT NULL,
    design varchar(100) NOT NULL,
    owner_name varchar(100) NOT NULL,
    design_type varchar(20) NOT NULL DEFAULT 'Standard',
    status varchar(20) NOT NULL DEFAULT 'Not started',
    aggregate_version bigint NOT NULL DEFAULT 1,
    source_event_id uuid NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    event_occurred_at timestamptz NOT NULL,
    stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_wellbore_designs_natural_key UNIQUE (company, project, site, well, wellbore, design, owner_name),
    CONSTRAINT uq_wellbore_designs_source_event UNIQUE (source_event_id),
    CONSTRAINT ck_wellbore_designs_company_not_blank CHECK (btrim(company) <> ''),
    CONSTRAINT ck_wellbore_designs_well_not_blank CHECK (btrim(well) <> ''),
    CONSTRAINT ck_wellbore_designs_wellbore_not_blank CHECK (btrim(wellbore) <> ''),
    CONSTRAINT ck_wellbore_designs_design_not_blank CHECK (btrim(design) <> ''),
    CONSTRAINT ck_wellbore_designs_design_type CHECK (
        design_type IN ('Standard', 'Montage')
    ),
    CONSTRAINT ck_wellbore_designs_status CHECK (
        status IN ('Not started', 'Data received', 'In progress', 'Completed')
    ),
    CONSTRAINT ck_wellbore_designs_aggregate_version CHECK (aggregate_version >= 1)
);

CREATE INDEX ix_wellbore_designs_active_status
    ON wellbore_designs (status, updated_at DESC)
    WHERE NOT is_deleted;

CREATE INDEX ix_wellbore_designs_well_search
    ON wellbore_designs USING gin (well gin_trgm_ops)
    WHERE NOT is_deleted;

CREATE INDEX ix_wellbore_designs_wellbore_search
    ON wellbore_designs USING gin (wellbore gin_trgm_ops)
    WHERE NOT is_deleted;

CREATE TABLE milestones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wellbore_design_id uuid NOT NULL REFERENCES wellbore_designs(id),
    milestone_type varchar(50) NOT NULL,
    occurred_at timestamptz NOT NULL,
    source_event_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_milestones_design_type UNIQUE (wellbore_design_id, milestone_type),
    CONSTRAINT ck_milestones_type CHECK (
        milestone_type IN (
            'GnG data received',
            'MDT conducted',
            'Design initiated',
            'Sent to DFS',
            'Received from DFS',
            'Sent to cementing team',
            'Received from cementing team',
            'Approvals initiated',
            'Approvals Level 1',
            'Approvals Level 2',
            'Approvals Level 3'
        )
    )
);

CREATE INDEX ix_milestones_design_id
    ON milestones (wellbore_design_id);

COMMIT;
