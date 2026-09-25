-- Tri-M Vendor application - database schema and seed data
-- Regenerated from the LIVE working database (tri_m_vendor) on 2026-09-25T17:21:48.503Z.
-- Schema source of truth: the current application (server/src/db/schema.js plus
-- server/src/db/index.js MIGRATIONS and the store.js queries that read/write the
-- live DB). 27 tables, matching the running backend (port 4000).
--
-- Only seed data COMPATIBLE with the FINAL system is included:
--   vendors, users, suppliers, supplier_products, arrivals, arrival_items,
--   receipts, receipt_items, vendor_receivings, vendor_receiving_items,
--   supply_requests, supply_request_items, receipt_corrections.
-- Runtime tables (sessions, revoked_tokens, audit_logs, notifications,
-- delivery_documents) and the public-portal application / supplier evaluation
-- tables are created EMPTY so a fresh install boots clean.

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `tri_m_vendor`
--

SET FOREIGN_KEY_CHECKS = 0;
-- --------------------------------------------------------

--
-- Table structure for table `application_documents`
--

DROP TABLE IF EXISTS `application_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `application_documents` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(40) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `mime_type` varchar(120) NOT NULL,
  `size_bytes` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ad_application` (`application_id`),
  CONSTRAINT `fk_ad_application` FOREIGN KEY (`application_id`) REFERENCES `supplier_applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `application_products`
--

DROP TABLE IF EXISTS `application_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `application_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` varchar(40) NOT NULL,
  `name` varchar(180) NOT NULL,
  `category` varchar(60) NOT NULL DEFAULT '',
  `description` varchar(500) NOT NULL DEFAULT '',
  `brand` varchar(160) NOT NULL DEFAULT '',
  `supply_capacity` varchar(120) NOT NULL DEFAULT '',
  `min_order_qty` varchar(120) NOT NULL DEFAULT '',
  `price_range` varchar(120) NOT NULL DEFAULT '',
  `unit` varchar(20) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `fk_ap_application` (`application_id`),
  CONSTRAINT `fk_ap_application` FOREIGN KEY (`application_id`) REFERENCES `supplier_applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `application_timeline`
--

DROP TABLE IF EXISTS `application_timeline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `application_timeline` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` varchar(40) NOT NULL,
  `action` varchar(120) NOT NULL,
  `actor` varchar(100) NOT NULL DEFAULT '',
  `note` varchar(1000) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_at_application` (`application_id`),
  CONSTRAINT `fk_at_application` FOREIGN KEY (`application_id`) REFERENCES `supplier_applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `arrival_items`
--

DROP TABLE IF EXISTS `arrival_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `arrival_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `arrival_id` varchar(40) NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `qty` int(11) NOT NULL,
  `unit` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ai_arrival` (`arrival_id`),
  CONSTRAINT `fk_ai_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `arrivals`
--

DROP TABLE IF EXISTS `arrivals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `arrivals` (
  `id` varchar(40) NOT NULL,
  `source_ref` varchar(40) NOT NULL,
  `supplier_id` varchar(30) NOT NULL,
  `supplier_name` varchar(180) NOT NULL,
  `total_qty` int(11) NOT NULL,
  `expected_date` date DEFAULT NULL,
  `expected_time` varchar(20) NOT NULL DEFAULT '',
  `destination` varchar(255) NOT NULL DEFAULT '',
  `remarks` varchar(500) NOT NULL DEFAULT '',
  `supply_request_id` varchar(40) DEFAULT NULL,
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `status` varchar(30) NOT NULL DEFAULT 'expected',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_arrivals_status` (`status`),
  KEY `idx_arrivals_vendor` (`vendor_id`),
  KEY `fk_arrival_supplier` (`supplier_id`),
  KEY `idx_arrivals_supply_request` (`supply_request_id`),
  CONSTRAINT `fk_arrival_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `fk_arrival_supply_request` FOREIGN KEY (`supply_request_id`) REFERENCES `supply_requests` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `vendor_id` varchar(40) DEFAULT NULL,
  `action` varchar(60) NOT NULL,
  `entity_type` varchar(60) NOT NULL DEFAULT '',
  `entity_id` varchar(100) NOT NULL DEFAULT '',
  `detail` varchar(1000) NOT NULL DEFAULT '',
  `ip` varchar(64) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_vendor_time` (`vendor_id`,`created_at`),
  KEY `idx_audit_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=198 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `company_documents`
--

DROP TABLE IF EXISTS `company_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `company_documents` (
  `id` varchar(64) NOT NULL,
  `vendor_id` varchar(40) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `mime_type` varchar(120) NOT NULL,
  `size_bytes` int(11) NOT NULL,
  `uploaded_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cd_vendor` (`vendor_id`),
  CONSTRAINT `fk_cd_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `delivery_documents`
--

DROP TABLE IF EXISTS `delivery_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `delivery_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `arrival_id` varchar(40) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `mime_type` varchar(120) NOT NULL,
  `size_bytes` int(11) NOT NULL,
  `uploaded_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_dd_arrival` (`arrival_id`),
  CONSTRAINT `fk_dd_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `discrepancy_reports`
--

DROP TABLE IF EXISTS `discrepancy_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `discrepancy_reports` (
  `id` varchar(40) NOT NULL,
  `arrival_id` varchar(40) NOT NULL,
  `receipt_id` varchar(40) DEFAULT NULL,
  `discrepancy_type` varchar(40) NOT NULL,
  `description` varchar(1000) NOT NULL,
  `requested_correction` varchar(1000) NOT NULL DEFAULT '',
  `reported_by` varchar(120) NOT NULL DEFAULT '',
  `reported_at` datetime NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'submitted',
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_dr_arrival` (`arrival_id`),
  KEY `idx_dr_vendor` (`vendor_id`),
  CONSTRAINT `fk_dr_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `evaluation_criteria`
--

DROP TABLE IF EXISTS `evaluation_criteria`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `evaluation_criteria` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `evaluation_id` int(11) NOT NULL,
  `criterion` varchar(40) NOT NULL,
  `label` varchar(120) NOT NULL,
  `weight` int(11) NOT NULL,
  `score` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ec_evaluation` (`evaluation_id`),
  CONSTRAINT `fk_ec_evaluation` FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `evaluations`
--

DROP TABLE IF EXISTS `evaluations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `evaluations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `supplier_id` varchar(30) NOT NULL,
  `evaluator_id` int(11) DEFAULT NULL,
  `comment` varchar(1000) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_eval_supplier` (`supplier_id`),
  KEY `fk_eval_user` (`evaluator_id`),
  CONSTRAINT `fk_eval_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_eval_user` FOREIGN KEY (`evaluator_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` varchar(40) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` varchar(500) NOT NULL DEFAULT '',
  `type` varchar(20) NOT NULL DEFAULT 'info',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `recipient` varchar(20) NOT NULL DEFAULT 'all',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_read` (`is_read`),
  KEY `idx_notifications_vendor` (`vendor_id`),
  KEY `idx_notifications_recipient` (`recipient`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `receipt_corrections`
--

DROP TABLE IF EXISTS `receipt_corrections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `receipt_corrections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `receipt_id` varchar(40) NOT NULL,
  `arrival_id` varchar(40) DEFAULT NULL,
  `reopen_reason` varchar(500) NOT NULL DEFAULT '',
  `reopen_remarks` varchar(500) NOT NULL DEFAULT '',
  `reopened_by` varchar(120) NOT NULL DEFAULT '',
  `reopened_at` datetime DEFAULT NULL,
  `saved_by` varchar(120) NOT NULL DEFAULT '',
  `saved_at` datetime NOT NULL,
  `old_total_qty` decimal(12,3) NOT NULL,
  `new_total_qty` decimal(12,3) NOT NULL,
  `old_good_qty` decimal(12,3) NOT NULL,
  `new_good_qty` decimal(12,3) NOT NULL,
  `old_damaged_qty` decimal(12,3) NOT NULL,
  `new_damaged_qty` decimal(12,3) NOT NULL,
  `good_adjustment` decimal(12,3) NOT NULL,
  `old_items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_items`)),
  `new_items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_items`)),
  PRIMARY KEY (`id`),
  KEY `idx_rc_receipt` (`receipt_id`),
  KEY `idx_rc_arrival` (`arrival_id`),
  CONSTRAINT `fk_rc_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `receipts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `receipt_items`
--

DROP TABLE IF EXISTS `receipt_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `receipt_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `receipt_id` varchar(40) NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `qty` decimal(12,3) NOT NULL,
  `total_received_quantity` decimal(12,3) DEFAULT NULL,
  `unit` varchar(20) NOT NULL,
  `condition_value` varchar(20) NOT NULL DEFAULT 'good',
  `return_to_sc` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_ri_receipt_product` (`receipt_id`,`product_name`,`unit`),
  CONSTRAINT `fk_ri_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `receipts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_ri_qty` CHECK (`qty` > 0),
  CONSTRAINT `chk_ri_total` CHECK (`total_received_quantity` is null or `total_received_quantity` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `receipts`
--

DROP TABLE IF EXISTS `receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `receipts` (
  `id` varchar(40) NOT NULL,
  `arrival_id` varchar(40) DEFAULT NULL,
  `supplier_id` varchar(30) NOT NULL,
  `supplier_name` varchar(180) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'confirmed',
  `total_qty` decimal(12,3) NOT NULL DEFAULT 0.000,
  `received_at` datetime NOT NULL,
  `receiving_by` varchar(120) NOT NULL DEFAULT '',
  `doc_ref` varchar(120) NOT NULL DEFAULT '',
  `remarks` varchar(500) NOT NULL DEFAULT '',
  `kind` varchar(20) NOT NULL DEFAULT 'original',
  `replacement_request_id` varchar(40) DEFAULT NULL,
  `reopen_reason` varchar(500) NOT NULL DEFAULT '',
  `reopen_remarks` varchar(500) NOT NULL DEFAULT '',
  `reopened_by` varchar(120) NOT NULL DEFAULT '',
  `reopened_at` datetime DEFAULT NULL,
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_receipts_arrival` (`arrival_id`),
  KEY `idx_receipts_supplier` (`supplier_id`),
  KEY `idx_receipts_status` (`status`),
  KEY `idx_receipts_vendor` (`vendor_id`),
  KEY `idx_receipts_kind` (`kind`),
  KEY `idx_receipts_replacement` (`replacement_request_id`),
  CONSTRAINT `fk_receipt_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_receipt_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `chk_receipts_total` CHECK (`total_qty` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `replacement_requests`
--

DROP TABLE IF EXISTS `replacement_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `replacement_requests` (
  `id` varchar(40) NOT NULL,
  `arrival_id` varchar(40) NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `expected_qty` decimal(12,3) NOT NULL,
  `accepted_qty` decimal(12,3) NOT NULL,
  `damaged_qty` decimal(12,3) NOT NULL,
  `replacement_qty` decimal(12,3) NOT NULL,
  `reason` varchar(500) NOT NULL DEFAULT '',
  `remarks` varchar(500) NOT NULL DEFAULT '',
  `status` varchar(20) NOT NULL DEFAULT 'requested',
  `requested_by` varchar(120) NOT NULL DEFAULT '',
  `requested_at` datetime NOT NULL,
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_rpl_arrival` (`arrival_id`),
  KEY `idx_rpl_status` (`status`),
  KEY `idx_rpl_vendor` (`vendor_id`),
  CONSTRAINT `fk_rpl_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `revoked_tokens`
--

DROP TABLE IF EXISTS `revoked_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `revoked_tokens` (
  `jti` varchar(64) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`jti`),
  KEY `idx_revoked_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `jti` varchar(64) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `vendor_id` varchar(40) DEFAULT NULL,
  `last_seen` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`jti`),
  KEY `idx_sessions_user` (`user_id`),
  KEY `idx_sessions_expiry` (`expires_at`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `supplier_applications`
--

DROP TABLE IF EXISTS `supplier_applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `supplier_applications` (
  `id` varchar(40) NOT NULL,
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `company_name` varchar(180) NOT NULL,
  `business_reg_no` varchar(80) NOT NULL DEFAULT '',
  `tin` varchar(60) NOT NULL DEFAULT '',
  `address` varchar(255) NOT NULL DEFAULT '',
  `email` varchar(160) NOT NULL DEFAULT '',
  `phone` varchar(60) NOT NULL DEFAULT '',
  `website` varchar(160) NOT NULL DEFAULT '',
  `distribution_area` varchar(255) NOT NULL DEFAULT '',
  `contact_name` varchar(120) NOT NULL DEFAULT '',
  `contact_position` varchar(120) NOT NULL DEFAULT '',
  `supplier_type` varchar(30) NOT NULL DEFAULT 'Other',
  `years_in_business` int(11) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'pending_review',
  `approved_supplier_id` varchar(30) DEFAULT NULL,
  `revision_note` varchar(1000) NOT NULL DEFAULT '',
  `rejection_reason` varchar(1000) NOT NULL DEFAULT '',
  `submitted_at` datetime NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_apply_status` (`status`),
  KEY `idx_apply_email` (`email`),
  KEY `idx_apply_vendor` (`vendor_id`),
  KEY `fk_apply_supplier` (`approved_supplier_id`),
  CONSTRAINT `fk_apply_supplier` FOREIGN KEY (`approved_supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_apply_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `supplier_products`
--

DROP TABLE IF EXISTS `supplier_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `supplier_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `supplier_id` varchar(30) NOT NULL,
  `name` varchar(180) NOT NULL,
  `description` varchar(500) NOT NULL DEFAULT '',
  `brand` varchar(160) NOT NULL DEFAULT '',
  `category` varchar(60) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `fk_sp_supplier` (`supplier_id`),
  CONSTRAINT `fk_sp_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `suppliers` (
  `id` varchar(30) NOT NULL,
  `source_ref` varchar(40) NOT NULL,
  `source_application_id` varchar(40) DEFAULT NULL,
  `company_name` varchar(180) NOT NULL,
  `contact_name` varchar(120) NOT NULL,
  `contact_email` varchar(160) NOT NULL,
  `contact_phone` varchar(60) NOT NULL,
  `supplier_type` varchar(30) NOT NULL,
  `address` varchar(255) NOT NULL DEFAULT '',
  `email` varchar(160) NOT NULL DEFAULT '',
  `phone` varchar(60) NOT NULL DEFAULT '',
  `website` varchar(160) NOT NULL DEFAULT '',
  `distribution_area` varchar(255) NOT NULL DEFAULT '',
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `evaluation_score` decimal(5,2) DEFAULT NULL,
  `performance_rating` decimal(5,2) DEFAULT NULL,
  `last_evaluated` datetime DEFAULT NULL,
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `established_on` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `source_ref` (`source_ref`),
  KEY `idx_suppliers_status` (`status`),
  KEY `idx_suppliers_vendor` (`vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `supply_request_items`
--

DROP TABLE IF EXISTS `supply_request_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `supply_request_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `request_id` varchar(40) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `product_name` varchar(180) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `remarks` varchar(500) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sri_request_product` (`request_id`,`product_id`),
  KEY `fk_sri_product` (`product_id`),
  CONSTRAINT `fk_sri_product` FOREIGN KEY (`product_id`) REFERENCES `supplier_products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sri_request` FOREIGN KEY (`request_id`) REFERENCES `supply_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_sri_qty` CHECK (`quantity` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `supply_requests`
--

DROP TABLE IF EXISTS `supply_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `supply_requests` (
  `id` varchar(40) NOT NULL,
  `requested_by` int(11) NOT NULL,
  `request_date` datetime NOT NULL,
  `needed_by_date` date NOT NULL,
  `priority` varchar(10) NOT NULL DEFAULT 'normal',
  `reason` varchar(500) NOT NULL,
  `remarks` varchar(500) NOT NULL DEFAULT '',
  `status` varchar(30) NOT NULL DEFAULT 'draft',
  `submitted_at` datetime DEFAULT NULL,
  `sc_reference` varchar(60) NOT NULL DEFAULT '',
  `processing_status` varchar(40) NOT NULL DEFAULT '',
  `supplier_id` varchar(30) DEFAULT NULL,
  `supplier_name` varchar(180) NOT NULL DEFAULT '',
  `expected_delivery_date` date DEFAULT NULL,
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_req_status` (`status`),
  KEY `idx_req_requested_by` (`requested_by`),
  KEY `idx_req_supplier` (`supplier_id`),
  KEY `idx_req_vendor` (`vendor_id`),
  CONSTRAINT `fk_sr_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sr_user` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(100) NOT NULL DEFAULT '',
  `role` varchar(50) NOT NULL DEFAULT 'admin',
  `vendor_id` varchar(40) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_users_vendor` (`vendor_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `vendor_receiving_items`
--

DROP TABLE IF EXISTS `vendor_receiving_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vendor_receiving_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `receiving_id` varchar(40) NOT NULL,
  `arrival_id` varchar(40) NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `received_qty` decimal(12,3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vri_receiving` (`receiving_id`),
  KEY `idx_vri_arrival_product` (`arrival_id`,`product_name`,`unit`),
  CONSTRAINT `fk_vri_receiving` FOREIGN KEY (`receiving_id`) REFERENCES `vendor_receivings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_vri_qty` CHECK (`received_qty` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `vendor_receivings`
--

DROP TABLE IF EXISTS `vendor_receivings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vendor_receivings` (
  `id` varchar(40) NOT NULL,
  `arrival_id` varchar(40) NOT NULL,
  `received_by` varchar(120) NOT NULL DEFAULT '',
  `received_at` datetime NOT NULL,
  `remarks` varchar(500) NOT NULL DEFAULT '',
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_vr_arrival` (`arrival_id`),
  KEY `idx_vr_vendor` (`vendor_id`),
  CONSTRAINT `fk_vr_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vendors` (
  `id` varchar(40) NOT NULL,
  `company_name` varchar(180) NOT NULL,
  `contact_name` varchar(120) NOT NULL DEFAULT '',
  `contact_email` varchar(160) NOT NULL DEFAULT '',
  `contact_phone` varchar(60) NOT NULL DEFAULT '',
  `address` varchar(255) NOT NULL DEFAULT '',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `vendors` VALUES ('VND-2026-0001','Tri-M Global Logistics & Trading Inc.','Warehouse Supervisor','info.tmglt@gmail.com','+63 2 5555 0100','Blk. 1A Lot 14, Verde Heights Subd., Brgy. Gaya-Gaya, City of San Jose del Monte, Bulacan',1,'2026-09-25 06:17:37','2026-09-25 06:17:37');

INSERT INTO `users` VALUES (1,'admin','$2b$10$W6wwvUleYPPICJ7ttrKyxuTJcEQ9zLCvymp9VEvpSfMq3foUd5pxO','Administrator','admin','VND-2026-0001','2026-09-25 06:17:37');
--
-- Dumping data for table `users`
--

INSERT INTO `users` VALUES (2,'staff','$2b$10$I4M8DAJGJGgUc6vCLhgpl.WqkkXXHj70UJRODN8Ux82P8jCWLOCyC','Receiving Staff','receiving_staff','VND-2026-0001','2026-09-25 06:47:06');

INSERT INTO `suppliers` VALUES ('SUP-2026-10001','SCSUP-2026-0140',NULL,'BeautyPH Cosmetics Inc.','Ana Reyes','a.reyes@beautyphcosmetics.com','+63 920 543 2109','Importer','78 Shaw Blvd, Mandaluyong City, Metro Manila','sales@beautyphcosmetics.com','+63 2 6666 3333','www.beautyphcosmetics.com','Metro Manila, Cebu, Davao','active',NULL,NULL,NULL,'VND-2026-0001','2026-06-17','2026-09-25 06:17:37');
--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` VALUES ('SUP-2026-10032','SCSUP-2026-0131',NULL,'Pacific Dry Goods Trading','Marco Santos','marco@pacificdry.ph','+63 917 812 3456','Wholesaler','12 Harbor Drive, Port Area, Manila','marco@pacificdry.ph','+63 2 8888 1111','www.pacificdry.ph','Metro Manila, Luzon','active',NULL,NULL,NULL,'VND-2026-0001','2026-07-07','2026-09-25 06:17:37');
INSERT INTO `suppliers` VALUES ('SUP-2026-10045','SCSUP-2026-0156',NULL,'Pacific Fresh Distributors Inc.','Maria Santos','maria.santos@pacificfresh.ph','+63 917 123 4567','Distributor','45 Macapagal Blvd, Pasay City, Metro Manila','info@pacificfresh.ph','+63 2 8888 5555','www.pacificfresh.ph','Metro Manila, Luzon','active',NULL,NULL,NULL,'VND-2026-0001','2026-08-11','2026-09-25 06:17:37');
--
-- Dumping data for table `supplier_products`
--

INSERT INTO `supplier_products` VALUES (1,'SUP-2026-10001','Korean BB Cream SPF 50+','Multi-function BB cream with sun protection and moisturizing formula.','GlowKor','Cosmetic Products');
INSERT INTO `supplier_products` VALUES (2,'SUP-2026-10001','Hyaluronic Acid Serum 30ml','2% HA serum with panthenol and ceramide complex for intense hydration.','GlowKor','Cosmetic Products');
INSERT INTO `supplier_products` VALUES (3,'SUP-2026-10001','Matte Lipstick Trio','Long-wear matte lipstick set in three shades.','GlowKor','Cosmetic Products');
INSERT INTO `supplier_products` VALUES (4,'SUP-2026-10032','Premium Jasmine Rice 25kg','Premium long-grain jasmine rice in sealed 25kg sacks.','Pacific Dry','Dry Products');
INSERT INTO `supplier_products` VALUES (5,'SUP-2026-10032','Canned Sardines 155g','Canned sardines in tomato sauce, 155g.','Pacific Dry','Dry Products');
INSERT INTO `supplier_products` VALUES (6,'SUP-2026-10045','Premium Frozen Tilapia Fillet','Grade A frozen tilapia fillets, IQF processed, sizes 100–200g.','Pacific Fresh','Frozen Products');
INSERT INTO `supplier_products` VALUES (7,'SUP-2026-10045','Frozen Shrimp Vannamei (HLSO)','Head-less shell-on frozen shrimp, various count sizes available.','Pacific Fresh','Frozen Products');

INSERT INTO `arrivals` VALUES ('SC-DLV-2026-0272','SC-SCHED-2026-0272','SUP-2026-10045','Pacific Fresh Distributors Inc.',150,'2026-09-21','7:30 AM','Tri-M MDC — Cold Storage','Cold chain broke in transit; returned to supplier; replacement scheduled.',NULL,'VND-2026-0001','pending','2026-09-20 01:00:00');
--
-- Dumping data for table `arrivals`
--

INSERT INTO `arrivals` VALUES ('SC-DLV-2026-0287','SC-SCHED-2026-0287','SUP-2026-10001','BeautyPH Cosmetics Inc.',120,'2026-09-23','11:00 AM','Tri-M MDC — Warehouse A','Physical count verified.','VR-2026-0004','VND-2026-0001','completed','2026-09-22 01:00:00');
INSERT INTO `arrivals` VALUES ('SC-DLV-2026-0298','SC-SCHED-2026-0298','SUP-2026-10032','Pacific Dry Goods Trading',2000,'2026-09-22','2:00 PM','Tri-M MDC — Warehouse A','Balance of 400 pcs pending from supplier.','VR-2026-0003','VND-2026-0001','partially_received','2026-09-21 01:00:00');
INSERT INTO `arrivals` VALUES ('SC-DLV-2026-0311','SC-SCHED-2026-0311','SUP-2026-10001','BeautyPH Cosmetics Inc.',320,'2026-09-24','10:00 AM','Tri-M MDC — Warehouse A','',NULL,'VND-2026-0001','completed','2026-09-19 01:00:00');
INSERT INTO `arrivals` VALUES ('SC-DLV-2026-0334','SC-SCHED-2026-0334','SUP-2026-10032','Pacific Dry Goods Trading',100,'2026-09-25','9:00 AM','Tri-M MDC — Warehouse A','Delivery truck arrived at site.',NULL,'VND-2026-0001','pending','2026-09-23 01:00:00');
INSERT INTO `arrivals` VALUES ('SC-DLV-2026-0338','SC-SCHED-2026-0338','SUP-2026-10045','Pacific Fresh Distributors Inc.',500,'2026-09-26','8:30 AM','Tri-M MDC — Cold Storage','',NULL,'VND-2026-0001','pending','2026-09-24 01:00:00');

INSERT INTO `arrival_items` VALUES (1,'SC-DLV-2026-0311','Korean BB Cream SPF 50+',200,'pcs');
--
-- Dumping data for table `arrival_items`
--

INSERT INTO `arrival_items` VALUES (2,'SC-DLV-2026-0311','Hyaluronic Acid Serum 30ml',120,'pcs');
INSERT INTO `arrival_items` VALUES (3,'SC-DLV-2026-0334','Premium Jasmine Rice 25kg',100,'sack');
INSERT INTO `arrival_items` VALUES (4,'SC-DLV-2026-0338','Premium Frozen Tilapia Fillet',300,'kg');
INSERT INTO `arrival_items` VALUES (5,'SC-DLV-2026-0338','Frozen Shrimp Vannamei (HLSO)',200,'kg');
INSERT INTO `arrival_items` VALUES (6,'SC-DLV-2026-0298','Canned Sardines 155g',2000,'pcs');
INSERT INTO `arrival_items` VALUES (7,'SC-DLV-2026-0287','Matte Lipstick Trio',120,'pcs');
INSERT INTO `arrival_items` VALUES (8,'SC-DLV-2026-0272','Frozen Shrimp Vannamei (HLSO)',150,'kg');

INSERT INTO `receipts` VALUES ('RR-2026-0072','SC-DLV-2026-0272','SUP-2026-10045','Pacific Fresh Distributors Inc.','confirmed',150.000,'2026-09-21 14:00:00','J. Mercado','DR-2026-5859','Rejected — cold chain broken in transit, product temperature above acceptable range.','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 06:17:37');
--
-- Dumping data for table `receipts`
--

INSERT INTO `receipts` VALUES ('RR-2026-0075','SC-DLV-2026-0287','SUP-2026-10001','BeautyPH Cosmetics Inc.','confirmed',120.000,'2026-09-23 11:00:00','K. Banag','DR-2026-5866','Count and condition verified, pending final confirmation.','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 06:17:37');
INSERT INTO `receipts` VALUES ('RR-2026-0078','SC-DLV-2026-0298','SUP-2026-10032','Pacific Dry Goods Trading','confirmed',1500.000,'2026-09-22 14:00:00','R. Dela Cruz','DR-2026-5871','Received 1500 of 2000 pcs; balance pending.','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 06:17:37');
INSERT INTO `receipts` VALUES ('RR-2026-0081','SC-DLV-2026-0311','SUP-2026-10001','BeautyPH Cosmetics Inc.','confirmed',320.000,'2026-09-24 14:00:00','R. Dela Cruz','DR-2026-5881','Completed receiving; forwarded to inventory.','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 06:17:37');
INSERT INTO `receipts` VALUES ('RR-2026-0085','SC-DLV-2026-0298','SUP-2026-10032','Pacific Dry Goods Trading','confirmed',100.000,'2026-09-25 11:00:00','R. Dela Cruz','DR-2026-5887','50 units found damaged during receiving inspection.','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 06:17:37');
INSERT INTO `receipts` VALUES ('RR-2026-13092','SC-DLV-2026-0298','SUP-2026-10032','Pacific Dry Goods Trading','confirmed',2000.000,'2026-09-25 20:41:00','Administrator','SC-DLV-2026-0298','goods','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 12:42:16');
INSERT INTO `receipts` VALUES ('RR-2026-14487','SC-DLV-2026-0272','SUP-2026-10045','Pacific Fresh Distributors Inc.','confirmed',150.000,'2026-09-25 20:51:00','Administrator','SC-DLV-2026-0272','asdad','original',NULL,'Incorrect quantity recorded','','admin','2026-09-25 21:00:42','VND-2026-0001','2026-09-25 12:51:47');
INSERT INTO `receipts` VALUES ('RR-2026-27730','SC-DLV-2026-0338','SUP-2026-10045','Pacific Fresh Distributors Inc.','confirmed',500.000,'2026-09-25 21:49:00','Administrator','SC-DLV-2026-0338','one is damage','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 13:49:17');
INSERT INTO `receipts` VALUES ('RR-2026-28877','SC-DLV-2026-0272','SUP-2026-10045','Pacific Fresh Distributors Inc.','confirmed',150.000,'2026-09-25 20:43:00','Administrator','SC-DLV-2026-0272','sdf','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 12:43:48');
INSERT INTO `receipts` VALUES ('RR-2026-30694','SC-DLV-2026-0298','SUP-2026-10032','Pacific Dry Goods Trading','confirmed',2000.000,'2026-09-25 20:29:00','Administrator','SC-DLV-2026-0298','asdasd','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 12:29:40');
INSERT INTO `receipts` VALUES ('RR-2026-61466','SC-DLV-2026-0298','SUP-2026-10032','Pacific Dry Goods Trading','confirmed',400.000,'2026-09-25 20:05:00','Administrator','SC-DLV','goods','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 12:05:57');
INSERT INTO `receipts` VALUES ('RR-2026-72599','SC-DLV-2026-0334','SUP-2026-10032','Pacific Dry Goods Trading','confirmed',100.000,'2026-09-25 21:23:00','Administrator','SC-DLV-2026-0334','goods','original',NULL,'','','',NULL,'VND-2026-0001','2026-09-25 13:23:27');

INSERT INTO `receipt_items` VALUES (1,'RR-2026-0081','Korean BB Cream SPF 50+',200.000,200.000,'pcs','good',0);
--
-- Dumping data for table `receipt_items`
--

INSERT INTO `receipt_items` VALUES (2,'RR-2026-0081','Hyaluronic Acid Serum 30ml',120.000,120.000,'pcs','good',0);
INSERT INTO `receipt_items` VALUES (3,'RR-2026-0078','Canned Sardines 155g',1500.000,1500.000,'pcs','good',0);
INSERT INTO `receipt_items` VALUES (4,'RR-2026-0075','Matte Lipstick Trio',120.000,120.000,'pcs','good',0);
INSERT INTO `receipt_items` VALUES (5,'RR-2026-0072','Frozen Shrimp Vannamei (HLSO)',150.000,150.000,'kg','rejected',0);
INSERT INTO `receipt_items` VALUES (6,'RR-2026-0085','Canned Sardines 155g',50.000,100.000,'pcs','good',0);
INSERT INTO `receipt_items` VALUES (7,'RR-2026-0085','Canned Sardines 155g',50.000,100.000,'pcs','damaged',0);
INSERT INTO `receipt_items` VALUES (8,'RR-2026-61466','Canned Sardines 155g',400.000,400.000,'box','good',0);
INSERT INTO `receipt_items` VALUES (9,'RR-2026-30694','Canned Sardines 155g',2000.000,2000.000,'box','good',0);
INSERT INTO `receipt_items` VALUES (10,'RR-2026-13092','Canned Sardines 155g',2000.000,2000.000,'box','good',0);
INSERT INTO `receipt_items` VALUES (11,'RR-2026-28877','Frozen Shrimp Vannamei (HLSO)',150.000,150.000,'pcs','good',0);
INSERT INTO `receipt_items` VALUES (13,'RR-2026-14487','Frozen Shrimp Vannamei (HLSO)',150.000,150.000,'bag','good',0);
INSERT INTO `receipt_items` VALUES (32,'RR-2026-72599','Premium Jasmine Rice 25kg',100.000,100.000,'sack','good',0);
INSERT INTO `receipt_items` VALUES (51,'RR-2026-27730','Premium Frozen Tilapia Fillet',300.000,300.000,'kg','damaged',0);
INSERT INTO `receipt_items` VALUES (52,'RR-2026-27730','Frozen Shrimp Vannamei (HLSO)',200.000,200.000,'kg','good',0);
--
-- Dumping data for table `vendor_receivings`
--

INSERT INTO `vendor_receivings` VALUES ('VRC-2026-0001','SC-DLV-2026-0311','M. Santos','2026-09-25 23:10:46','All accepted stock received and forwarded to inventory.','VND-2026-0001','2026-09-25 15:10:46');
INSERT INTO `vendor_receivings` VALUES ('VRC-2026-0002','SC-DLV-2026-0298','M. Santos','2026-09-25 23:10:46','Partial acknowledgement; remaining accepted stock still on the dock.','VND-2026-0001','2026-09-25 15:10:46');
INSERT INTO `vendor_receivings` VALUES ('VRC-2026-0003','SC-DLV-2026-0287','L. Villanueva','2026-09-25 23:10:46','Accepted stock received in full.','VND-2026-0001','2026-09-25 15:10:46');
INSERT INTO `vendor_receivings` VALUES ('VRC-2026-77687','SC-DLV-2026-0298','Administrator','2026-09-26 00:32:00','','VND-2026-0001','2026-09-25 16:32:58');
--
-- Dumping data for table `vendor_receiving_items`
--

INSERT INTO `vendor_receiving_items` VALUES (1,'VRC-2026-0001','SC-DLV-2026-0311','Korean BB Cream SPF 50+','pcs',200.000);
INSERT INTO `vendor_receiving_items` VALUES (2,'VRC-2026-0001','SC-DLV-2026-0311','Hyaluronic Acid Serum 30ml','pcs',120.000);
INSERT INTO `vendor_receiving_items` VALUES (3,'VRC-2026-0002','SC-DLV-2026-0298','Canned Sardines 155g','pcs',1000.000);
INSERT INTO `vendor_receiving_items` VALUES (4,'VRC-2026-0003','SC-DLV-2026-0287','Matte Lipstick Trio','pcs',120.000);
INSERT INTO `vendor_receiving_items` VALUES (11,'VRC-2026-77687','SC-DLV-2026-0298','Canned Sardines 155g','pcs',550.000);

INSERT INTO `supply_requests` VALUES ('VR-2026-0001',1,'2026-09-24 09:00:00','2026-09-29','normal','Advance stock-up of staple rice ahead of scheduled operations.','','draft',NULL,'','',NULL,'',NULL,'VND-2026-0001','2026-09-25 06:17:37','2026-09-25 06:17:37');
--
-- Dumping data for table `supply_requests`
--

INSERT INTO `supply_requests` VALUES ('VR-2026-0002',1,'2026-09-24 11:00:00','2026-09-27','high','Sustained institutional demand; maintain buffer stock of canned goods.','Preferred single-brand; source as coordinated by Supply Chain.','under_review','2026-09-24 12:00:00','SC-REQ-2026-0299','',NULL,'',NULL,'VND-2026-0001','2026-09-25 06:17:37','2026-09-25 06:17:37');
INSERT INTO `supply_requests` VALUES ('VR-2026-0003',1,'2026-09-20 09:00:00','2026-09-26','normal','Periodic bulk procurement of canned goods for retail operations.','','fulfillment_in_progress','2026-09-21 09:00:00','SC-REQ-2026-0298','','SUP-2026-10032','Pacific Dry Goods Trading','2026-09-26','VND-2026-0001','2026-09-25 06:17:37','2026-09-25 06:17:37');
INSERT INTO `supply_requests` VALUES ('VR-2026-0004',1,'2026-09-19 09:00:00','2026-09-24','low','Replenish cosmetic counter inventory for the upcoming launch promotion.','','fulfilled','2026-09-20 09:00:00','SC-REQ-2026-0287','','SUP-2026-10001','BeautyPH Cosmetics Inc.','2026-09-23','VND-2026-0001','2026-09-25 06:17:37','2026-09-25 06:17:37');

INSERT INTO `supply_request_items` VALUES (1,'VR-2026-0001',4,'Premium Jasmine Rice 25kg',100.000,'sack','','2026-09-25 06:17:37','2026-09-25 06:17:37');
--
-- Dumping data for table `supply_request_items`
--

INSERT INTO `supply_request_items` VALUES (2,'VR-2026-0002',5,'Canned Sardines 155g',500.000,'pcs','','2026-09-25 06:17:37','2026-09-25 06:17:37');
INSERT INTO `supply_request_items` VALUES (3,'VR-2026-0003',5,'Canned Sardines 155g',2000.000,'pcs','','2026-09-25 06:17:37','2026-09-25 06:17:37');
INSERT INTO `supply_request_items` VALUES (4,'VR-2026-0004',3,'Matte Lipstick Trio',120.000,'pcs','','2026-09-25 06:17:37','2026-09-25 06:17:37');

INSERT INTO `receipt_corrections` VALUES (1,'RR-2026-14487','SC-DLV-2026-0272','Incorrect quantity recorded','','admin','2026-09-25 20:59:45','admin','2026-09-25 21:00:24',150.000,150.000,0.000,150.000,0.000,0.000,150.000,'[{\"product_name\":\"Frozen Shrimp Vannamei (HLSO)\",\"qty\":\"150.000\",\"unit\":\"bag\",\"condition_value\":\"good\"}]','[{\"productName\":\"Frozen Shrimp Vannamei (HLSO)\",\"qty\":150,\"unit\":\"bag\",\"condition\":\"good\",\"declaredTotal\":150}]');

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
