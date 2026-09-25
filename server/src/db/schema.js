const TABLES = [
  `CREATE TABLE IF NOT EXISTS vendors (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    company_name VARCHAR(180) NOT NULL,
    contact_name VARCHAR(120) NOT NULL DEFAULT '',
    contact_email VARCHAR(160) NOT NULL DEFAULT '',
    contact_phone VARCHAR(60) NOT NULL DEFAULT '',
    address VARCHAR(255) NOT NULL DEFAULT '',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    vendor_id VARCHAR(40) NULL,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(60) NOT NULL DEFAULT '',
    entity_id VARCHAR(100) NOT NULL DEFAULT '',
    detail VARCHAR(1000) NOT NULL DEFAULT '',
    ip VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_vendor_time (vendor_id, created_at),
    INDEX idx_audit_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id INT NULL,
    expires_at DATETIME NOT NULL,
    revoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_revoked_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS company_documents (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    vendor_id VARCHAR(40) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes INT NOT NULL,
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cd_vendor (vendor_id),
    CONSTRAINT fk_cd_vendor FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    vendor_id VARCHAR(40) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_vendor (vendor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* Server-side inactivity tracking for Vendor Management sessions.
     A session is created at login and its sliding window (30 minutes)
     is bumped on every protected vendor request; once the window lapses
     the token is revoked and further access is denied with 401. */
  `CREATE TABLE IF NOT EXISTS sessions (
    jti VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id INT NULL,
    vendor_id VARCHAR(40) NULL,
    last_seen DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_expiry (expires_at),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(30) NOT NULL PRIMARY KEY,
    source_ref VARCHAR(40) NOT NULL UNIQUE,
    company_name VARCHAR(180) NOT NULL,
    contact_name VARCHAR(120) NOT NULL,
    contact_email VARCHAR(160) NOT NULL,
    contact_phone VARCHAR(60) NOT NULL,
    supplier_type VARCHAR(30) NOT NULL,
    address VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(160) NOT NULL DEFAULT '',
    phone VARCHAR(60) NOT NULL DEFAULT '',
    website VARCHAR(160) NOT NULL DEFAULT '',
    distribution_area VARCHAR(255) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    vendor_id VARCHAR(40) NOT NULL DEFAULT '',
    established_on DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_suppliers_status (status),
    INDEX idx_suppliers_vendor (vendor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS supplier_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id VARCHAR(30) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    brand VARCHAR(160) NOT NULL DEFAULT '',
    category VARCHAR(60) NOT NULL DEFAULT '',
    CONSTRAINT fk_sp_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS arrivals (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    source_ref VARCHAR(40) NOT NULL,
    supplier_id VARCHAR(30) NOT NULL,
    supplier_name VARCHAR(180) NOT NULL,
    total_qty INT NOT NULL,
    expected_date DATE NULL,
    expected_time VARCHAR(20) NOT NULL DEFAULT '',
    destination VARCHAR(255) NOT NULL DEFAULT '',
    remarks VARCHAR(500) NOT NULL DEFAULT '',
    vendor_id VARCHAR(40) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'expected',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_arrivals_status (status),
    INDEX idx_arrivals_vendor (vendor_id),
    CONSTRAINT fk_arrival_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS arrival_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    arrival_id VARCHAR(40) NOT NULL,
    product_name VARCHAR(180) NOT NULL,
    qty INT NOT NULL,
    unit VARCHAR(20) NOT NULL,
    CONSTRAINT fk_ai_arrival FOREIGN KEY (arrival_id) REFERENCES arrivals (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS receipts (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    arrival_id VARCHAR(40) NULL,
    supplier_id VARCHAR(30) NOT NULL,
    supplier_name VARCHAR(180) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    total_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
    received_at DATETIME NOT NULL,
    receiving_by VARCHAR(120) NOT NULL DEFAULT '',
    doc_ref VARCHAR(120) NOT NULL DEFAULT '',
    remarks VARCHAR(500) NOT NULL DEFAULT '',
    kind VARCHAR(20) NOT NULL DEFAULT 'original',
    replacement_request_id VARCHAR(40) NULL,
    vendor_id VARCHAR(40) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_receipts_arrival (arrival_id),
    INDEX idx_receipts_supplier (supplier_id),
    INDEX idx_receipts_status (status),
    INDEX idx_receipts_kind (kind),
    INDEX idx_receipts_replacement (replacement_request_id),
    INDEX idx_receipts_vendor (vendor_id),
    CONSTRAINT fk_receipt_arrival FOREIGN KEY (arrival_id) REFERENCES arrivals (id) ON DELETE SET NULL,
    CONSTRAINT fk_receipt_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
    CONSTRAINT chk_receipts_total CHECK (total_qty >= 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS receipt_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_id VARCHAR(40) NOT NULL,
    product_name VARCHAR(180) NOT NULL,
    qty DECIMAL(12,3) NOT NULL,
    total_received_quantity DECIMAL(12,3) NULL,
    unit VARCHAR(20) NOT NULL,
    condition_value VARCHAR(20) NOT NULL DEFAULT 'good',
    return_to_sc TINYINT(1) NOT NULL DEFAULT 0,
    INDEX idx_ri_receipt_product (receipt_id, product_name, unit),
    CONSTRAINT fk_ri_receipt FOREIGN KEY (receipt_id) REFERENCES receipts (id) ON DELETE CASCADE,
    CONSTRAINT chk_ri_qty CHECK (qty > 0),
    CONSTRAINT chk_ri_total CHECK (total_received_quantity IS NULL OR total_received_quantity >= 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* Replacement requests: the Vendor asks Supply Chain to re-supply products
     that arrived damaged or short. The quantity is ALWAYS derived by the system
     — the vendor never types a replacement amount. Damaged/rejected units are
     never accepted stock and are never requested as "extra" beyond the expected
     delivery. Status is separate from the receiving status. */
  `CREATE TABLE IF NOT EXISTS replacement_requests (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    arrival_id VARCHAR(40) NOT NULL,
    product_name VARCHAR(180) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    expected_qty DECIMAL(12,3) NOT NULL,
    accepted_qty DECIMAL(12,3) NOT NULL,
    damaged_qty DECIMAL(12,3) NOT NULL,
    replacement_qty DECIMAL(12,3) NOT NULL,
    reason VARCHAR(500) NOT NULL DEFAULT '',
    remarks VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'requested',
    requested_by VARCHAR(120) NOT NULL DEFAULT '',
    requested_at DATETIME NOT NULL,
    vendor_id VARCHAR(40) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rpl_arrival (arrival_id),
    INDEX idx_rpl_status (status),
    INDEX idx_rpl_vendor (vendor_id),
    CONSTRAINT fk_rpl_arrival FOREIGN KEY (arrival_id) REFERENCES arrivals (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* Correction history for reopened receiving records. A row is written on
     every saved correction: the reason for reopening, who/when reopened,
     who/when saved, and the exact before/after values so quantity changes
     can be audited and no stock movement is ever double-counted. */
  `CREATE TABLE IF NOT EXISTS receipt_corrections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_id VARCHAR(40) NOT NULL,
    arrival_id VARCHAR(40) NULL,
    reopen_reason VARCHAR(500) NOT NULL DEFAULT '',
    reopen_remarks VARCHAR(500) NOT NULL DEFAULT '',
    reopened_by VARCHAR(120) NOT NULL DEFAULT '',
    reopened_at DATETIME NULL,
    saved_by VARCHAR(120) NOT NULL DEFAULT '',
    saved_at DATETIME NOT NULL,
    old_total_qty DECIMAL(12,3) NOT NULL,
    new_total_qty DECIMAL(12,3) NOT NULL,
    old_good_qty DECIMAL(12,3) NOT NULL,
    new_good_qty DECIMAL(12,3) NOT NULL,
    old_damaged_qty DECIMAL(12,3) NOT NULL,
    new_damaged_qty DECIMAL(12,3) NOT NULL,
    good_adjustment DECIMAL(12,3) NOT NULL,
    old_items JSON NULL,
    new_items JSON NULL,
    INDEX idx_rc_receipt (receipt_id),
    INDEX idx_rc_arrival (arrival_id),
    CONSTRAINT fk_rc_receipt FOREIGN KEY (receipt_id) REFERENCES receipts (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS delivery_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    arrival_id VARCHAR(40) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes INT NOT NULL,
    uploaded_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dd_arrival (arrival_id),
    CONSTRAINT fk_dd_arrival FOREIGN KEY (arrival_id) REFERENCES arrivals (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* Vendor Receiving acknowledgments. The CHECKER result (who inspected and
     accepted) lives in receipts/receipt_items — only good units are accepted
     stock. This table records the Vendor acknowledging the ACCEPTED stock,
     possibly in multiple partial transactions:
       arrival status  = PENDING          → accepted stock ready, vendor received 0
                         PARTIALLY_RECEIVED → 0 < vendor received < accepted
                         COMPLETED          → vendor received all accepted stock
     Acknowledged units never touch stock again — stock was already recorded by
     the checker. Every row is a distinct, idempotent confirmation. */
  `CREATE TABLE IF NOT EXISTS vendor_receivings (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    arrival_id VARCHAR(40) NOT NULL,
    received_by VARCHAR(120) NOT NULL DEFAULT '',
    received_at DATETIME NOT NULL,
    remarks VARCHAR(500) NOT NULL DEFAULT '',
    vendor_id VARCHAR(40) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vr_arrival (arrival_id),
    INDEX idx_vr_vendor (vendor_id),
    CONSTRAINT fk_vr_arrival FOREIGN KEY (arrival_id) REFERENCES arrivals (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS vendor_receiving_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receiving_id VARCHAR(40) NOT NULL,
    arrival_id VARCHAR(40) NOT NULL,
    product_name VARCHAR(180) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    received_qty DECIMAL(12,3) NOT NULL,
    INDEX idx_vri_receiving (receiving_id),
    INDEX idx_vri_arrival_product (arrival_id, product_name, unit),
    CONSTRAINT fk_vri_receiving FOREIGN KEY (receiving_id) REFERENCES vendor_receivings (id) ON DELETE CASCADE,
    CONSTRAINT chk_vri_qty CHECK (received_qty > 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* Discrepancy reports raised by the Vendor against a delivery. The Vendor can
     never modify the Checker's accepted/damaged quantities — a mismatch is
     routed here as a traceable record for the responsible subsystem instead of
     a vendor-side reopen. */
  `CREATE TABLE IF NOT EXISTS discrepancy_reports (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    arrival_id VARCHAR(40) NOT NULL,
    receipt_id VARCHAR(40) NULL,
    discrepancy_type VARCHAR(40) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    requested_correction VARCHAR(1000) NOT NULL DEFAULT '',
    reported_by VARCHAR(120) NOT NULL DEFAULT '',
    reported_at DATETIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    vendor_id VARCHAR(40) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dr_arrival (arrival_id),
    INDEX idx_dr_vendor (vendor_id),
    CONSTRAINT fk_dr_arrival FOREIGN KEY (arrival_id) REFERENCES arrivals (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message VARCHAR(500) NOT NULL DEFAULT '',
    type VARCHAR(20) NOT NULL DEFAULT 'info',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    vendor_id VARCHAR(40) NOT NULL DEFAULT '',
    recipient VARCHAR(20) NOT NULL DEFAULT 'all',
    created_at DATETIME NOT NULL,
    INDEX idx_notifications_read (is_read),
    INDEX idx_notifications_vendor (vendor_id),
    INDEX idx_notifications_recipient (recipient)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS supply_requests (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    requested_by INT NOT NULL,
    request_date DATETIME NOT NULL,
    needed_by_date DATE NOT NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'normal',
    reason VARCHAR(500) NOT NULL,
    remarks VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    submitted_at DATETIME NULL,
    sc_reference VARCHAR(60) NOT NULL DEFAULT '',
    processing_status VARCHAR(40) NOT NULL DEFAULT '',
    supplier_id VARCHAR(30) NULL,
    supplier_name VARCHAR(180) NOT NULL DEFAULT '',
    expected_delivery_date DATE NULL,
    vendor_id VARCHAR(40) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_req_status (status),
    INDEX idx_req_requested_by (requested_by),
    INDEX idx_req_supplier (supplier_id),
    INDEX idx_req_vendor (vendor_id),
    CONSTRAINT fk_sr_user FOREIGN KEY (requested_by) REFERENCES users (id),
    CONSTRAINT fk_sr_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS supply_request_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(40) NOT NULL,
    product_id INT NULL,
    product_name VARCHAR(180) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    remarks VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sri_request_product (request_id, product_id),
    CONSTRAINT fk_sri_request FOREIGN KEY (request_id) REFERENCES supply_requests (id) ON DELETE CASCADE,
    CONSTRAINT fk_sri_product FOREIGN KEY (product_id) REFERENCES supplier_products (id) ON DELETE SET NULL,
    CONSTRAINT chk_sri_qty CHECK (quantity > 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* Public supplier applications drive the sourcing workflow: applicants
     submit through the public portal, Tri-M staff review and approve,
     and approval materializes a real suppliers row. */
  `CREATE TABLE IF NOT EXISTS supplier_applications (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    vendor_id VARCHAR(40) NOT NULL DEFAULT '',
    company_name VARCHAR(180) NOT NULL,
    business_reg_no VARCHAR(80) NOT NULL DEFAULT '',
    tin VARCHAR(60) NOT NULL DEFAULT '',
    address VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(160) NOT NULL DEFAULT '',
    phone VARCHAR(60) NOT NULL DEFAULT '',
    website VARCHAR(160) NOT NULL DEFAULT '',
    distribution_area VARCHAR(255) NOT NULL DEFAULT '',
    contact_name VARCHAR(120) NOT NULL DEFAULT '',
    contact_position VARCHAR(120) NOT NULL DEFAULT '',
    supplier_type VARCHAR(30) NOT NULL DEFAULT 'Other',
    years_in_business INT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
    approved_supplier_id VARCHAR(30) NULL,
    revision_note VARCHAR(1000) NOT NULL DEFAULT '',
    rejection_reason VARCHAR(1000) NOT NULL DEFAULT '',
    submitted_at DATETIME NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_apply_status (status),
    INDEX idx_apply_email (email),
    INDEX idx_apply_vendor (vendor_id),
    CONSTRAINT fk_apply_vendor FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
    CONSTRAINT fk_apply_supplier FOREIGN KEY (approved_supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS application_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(40) NOT NULL,
    name VARCHAR(180) NOT NULL,
    category VARCHAR(60) NOT NULL DEFAULT '',
    description VARCHAR(500) NOT NULL DEFAULT '',
    brand VARCHAR(160) NOT NULL DEFAULT '',
    supply_capacity VARCHAR(120) NOT NULL DEFAULT '',
    min_order_qty VARCHAR(120) NOT NULL DEFAULT '',
    price_range VARCHAR(120) NOT NULL DEFAULT '',
    unit VARCHAR(20) NOT NULL DEFAULT '',
    CONSTRAINT fk_ap_application FOREIGN KEY (application_id) REFERENCES supplier_applications (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS application_documents (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    application_id VARCHAR(40) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ad_application (application_id),
    CONSTRAINT fk_ad_application FOREIGN KEY (application_id) REFERENCES supplier_applications (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS application_timeline (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(40) NOT NULL,
    action VARCHAR(120) NOT NULL,
    actor VARCHAR(100) NOT NULL DEFAULT '',
    note VARCHAR(1000) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    INDEX idx_at_application (application_id),
    CONSTRAINT fk_at_application FOREIGN KEY (application_id) REFERENCES supplier_applications (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* Periodic admin evaluations of an approved supplier. Criteria scores live
     in evaluation_criteria; the weighted total is written back to suppliers. */
  `CREATE TABLE IF NOT EXISTS evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id VARCHAR(30) NOT NULL,
    evaluator_id INT NULL,
    comment VARCHAR(1000) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_eval_supplier (supplier_id),
    CONSTRAINT fk_eval_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE,
    CONSTRAINT fk_eval_user FOREIGN KEY (evaluator_id) REFERENCES users (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS evaluation_criteria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluation_id INT NOT NULL,
    criterion VARCHAR(40) NOT NULL,
    label VARCHAR(120) NOT NULL,
    weight INT NOT NULL,
    score INT NOT NULL,
    CONSTRAINT fk_ec_evaluation FOREIGN KEY (evaluation_id) REFERENCES evaluations (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export function createSchemaStatements() {
  return TABLES;
}