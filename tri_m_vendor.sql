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
   `sku` varchar(60) NOT NULL DEFAULT '',
   `stock` int(11) NOT NULL DEFAULT 0,
   `unit` varchar(20) NOT NULL DEFAULT 'pcs',
   PRIMARY KEY (`id`),
   KEY `fk_sp_supplier` (`supplier_id`),
   CONSTRAINT `fk_sp_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
 ) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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

INSERT INTO `supplier_products` VALUES (16,'SUP-2026-10001','Closeup Green Ulp R11','Oral care toothpaste, green flavor.','Closeup','Oral Care','COSM-0006',143,'pcs');
INSERT INTO `supplier_products` VALUES (17,'SUP-2026-10001','Closeup Red Hot Ulp R11','Oral care toothpaste, red hot flavor.','Closeup','Oral Care','COSM-0007',110,'pcs');
INSERT INTO `supplier_products` VALUES (18,'SUP-2026-10001','Cream Silk Hc Ultreborn Damage (Dark Blue)','Hair care conditioner for damaged hair, dark blue variant.','Cream Silk','Hair Care & Skin Care','COSM-0008',100,'pcs');
INSERT INTO `supplier_products` VALUES (19,'SUP-2026-10001','Cream Silk Hc Ultreborn Strt (Pink)','Hair care conditioner for starter hair, pink variant.','Cream Silk','Hair Care & Skin Care','COSM-0009',29,'pcs');
INSERT INTO `supplier_products` VALUES (20,'SUP-2026-10001','Cream Silk Tkr Straight 2','Hair care straightening treatment.','Cream Silk','Hair Care & Skin Care','COSM-0010',30,'pcs');
INSERT INTO `supplier_products` VALUES (21,'SUP-2026-10001','Eskinol Fw Aloe','Skincare aloe vera gel.','Eskinol','Hair Care & Skin Care','COSM-0004',120,'pcs');
INSERT INTO `supplier_products` VALUES (22,'SUP-2026-10001','Green Papaya Lotion','Skin whitening lotion with green papaya extract.','Green Papaya','Hair Care & Skin Care','COSM-0018',138,'pcs');
INSERT INTO `supplier_products` VALUES (23,'SUP-2026-10001','Moisturizing Avocado Oil Soap','Moisturizing soap with avocado oil.','Cosm','Hair Care & Skin Care','COSM-0002',68,'pcs');
INSERT INTO `supplier_products` VALUES (24,'SUP-2026-10001','Papaya Soap','Exfoliating papaya soap.','Cosm','Hair Care & Skin Care','COSM-0093',33,'pcs');
INSERT INTO `supplier_products` VALUES (25,'SUP-2026-10001','Surf Bar Blossom Fresh','Laundry bar with blossom fresh scent.','Surf','Household & Laundry','COSM-0060',23,'pcs');
INSERT INTO `supplier_products` VALUES (26,'SUP-2026-10001','Surf Bar Cherry Blossom','Laundry bar with cherry blossom scent.','Surf','Household & Laundry','COSM-0065',61,'pcs');
INSERT INTO `supplier_products` VALUES (27,'SUP-2026-10001','Surf Bar Purple Blooms','Laundry bar with purple blooms scent.','Surf','Household & Laundry','COSM-0066',133,'pcs');
INSERT INTO `supplier_products` VALUES (28,'SUP-2026-10001','Surf Bar Tawas','Laundry bar with tawas formula.','Surf','Household & Laundry','COSM-0063',39,'pcs');
INSERT INTO `supplier_products` VALUES (29,'SUP-2026-10001','Surf Hs Std Pwdr Blossomfresh','Laundry powder with blossomfresh scent.','Surf','Household & Laundry','COSM-0052',148,'pcs');
INSERT INTO `supplier_products` VALUES (30,'SUP-2026-10001','Surf Powder Kalamansi S','Laundry powder with kalamansi scent.','Surf','Household & Laundry','COSM-0057',138,'pcs');



SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
