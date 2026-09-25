-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: 09/25/2026 at 16:47:59
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `undefined`
--

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------

--
-- Table structure for table `application_documents`
--

DROP TABLE IF EXISTS `application_documents`;

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

--
-- Dumping data for table `application_documents`
--


-- --------------------------------------------------------

--
-- Table structure for table `application_products`
--

DROP TABLE IF EXISTS `application_products`;

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

--
-- Dumping data for table `application_products`
--


-- --------------------------------------------------------

--
-- Table structure for table `application_timeline`
--

DROP TABLE IF EXISTS `application_timeline`;

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

--
-- Dumping data for table `application_timeline`
--


-- --------------------------------------------------------

--
-- Table structure for table `arrival_items`
--

DROP TABLE IF EXISTS `arrival_items`;

CREATE TABLE `arrival_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `arrival_id` varchar(40) NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `qty` int(11) NOT NULL,
  `unit` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ai_arrival` (`arrival_id`),
  CONSTRAINT `fk_ai_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `arrival_items`
--

INSERT INTO `arrival_items` (`id`, `arrival_id`, `product_name`, `qty`, `unit`) VALUES
(1, 'SC-DLV-2026-0311', 'Korean BB Cream SPF 50+', 200, 'pcs'),
(2, 'SC-DLV-2026-0311', 'Hyaluronic Acid Serum 30ml', 120, 'pcs'),
(3, 'SC-DLV-2026-0334', 'Premium Jasmine Rice 25kg', 100, 'sack'),
(4, 'SC-DLV-2026-0338', 'Premium Frozen Tilapia Fillet', 300, 'kg'),
(5, 'SC-DLV-2026-0338', 'Frozen Shrimp Vannamei (HLSO)', 200, 'kg'),
(6, 'SC-DLV-2026-0298', 'Canned Sardines 155g', 2000, 'pcs'),
(7, 'SC-DLV-2026-0287', 'Matte Lipstick Trio', 120, 'pcs'),
(8, 'SC-DLV-2026-0272', 'Frozen Shrimp Vannamei (HLSO)', 150, 'kg');

-- --------------------------------------------------------

--
-- Table structure for table `arrivals`
--

DROP TABLE IF EXISTS `arrivals`;

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

--
-- Dumping data for table `arrivals`
--

INSERT INTO `arrivals` (`id`, `source_ref`, `supplier_id`, `supplier_name`, `total_qty`, `expected_date`, `expected_time`, `destination`, `remarks`, `supply_request_id`, `vendor_id`, `status`, `created_at`) VALUES
('SC-DLV-2026-0272', 'SC-SCHED-2026-0272', 'SUP-2026-10045', 'Pacific Fresh Distributors Inc.', 150, '2026-09-21', '7:30 AM', 'Tri-M MDC — Cold Storage', 'Cold chain broke in transit; returned to supplier; replacement scheduled.', NULL, 'VND-2026-0001', 'rejected_damaged', '2026-09-20 09:00:00'),
('SC-DLV-2026-0287', 'SC-SCHED-2026-0287', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', 120, '2026-09-23', '11:00 AM', 'Tri-M MDC — Warehouse A', 'Physical count verified.', 'VR-2026-0004', 'VND-2026-0001', 'received', '2026-09-22 09:00:00'),
('SC-DLV-2026-0298', 'SC-SCHED-2026-0298', 'SUP-2026-10032', 'Pacific Dry Goods Trading', 2000, '2026-09-22', '2:00 PM', 'Tri-M MDC — Warehouse A', 'Balance of 400 pcs pending from supplier.', 'VR-2026-0003', 'VND-2026-0001', 'partially_received', '2026-09-21 09:00:00'),
('SC-DLV-2026-0311', 'SC-SCHED-2026-0311', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', 320, '2026-09-24', '10:00 AM', 'Tri-M MDC — Warehouse A', '', NULL, 'VND-2026-0001', 'completed', '2026-09-19 09:00:00'),
('SC-DLV-2026-0334', 'SC-SCHED-2026-0334', 'SUP-2026-10032', 'Pacific Dry Goods Trading', 100, '2026-09-25', '9:00 AM', 'Tri-M MDC — Warehouse A', 'Delivery truck arrived at site.', NULL, 'VND-2026-0001', 'for_receiving', '2026-09-23 09:00:00'),
('SC-DLV-2026-0338', 'SC-SCHED-2026-0338', 'SUP-2026-10045', 'Pacific Fresh Distributors Inc.', 500, '2026-09-26', '8:30 AM', 'Tri-M MDC — Cold Storage', '', NULL, 'VND-2026-0001', 'for_receiving', '2026-09-24 09:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;

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
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `user_id`, `vendor_id`, `action`, `entity_type`, `entity_id`, `detail`, `ip`, `created_at`) VALUES
(1, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 14:22:09'),
(2, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 14:47:23'),
(3, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 15:23:30'),
(4, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 15:23:30'),
(5, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 15:37:29'),
(6, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 15:52:28'),
(7, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 15:52:28'),
(8, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 15:52:40'),
(9, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 15:52:40'),
(10, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 15:57:30'),
(11, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 15:57:46'),
(12, 2, 'VND-2026-0001', 'arrival.status', 'arrival', 'SC-DLV-2026-0338', 'Moved expected supply SC-DLV-2026-0338 to for_receiving.', '::1', '2026-09-25 15:57:47'),
(13, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 15:57:55'),
(14, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 16:17:23'),
(15, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 16:17:23'),
(16, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 16:17:36'),
(17, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 16:22:28'),
(18, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 16:22:28'),
(19, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 16:29:56'),
(20, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 16:29:56'),
(21, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 16:37:51'),
(22, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 16:37:51'),
(24, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 16:39:35'),
(27, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-25 16:40:10'),
(28, 2, 'VND-2026-0001', 'login', 'session', '', 'Receiving Staff signed in.', '::1', '2026-09-25 16:40:11');

-- --------------------------------------------------------

--
-- Table structure for table `company_documents`
--

DROP TABLE IF EXISTS `company_documents`;

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

--
-- Dumping data for table `company_documents`
--


-- --------------------------------------------------------

--
-- Table structure for table `evaluation_criteria`
--

DROP TABLE IF EXISTS `evaluation_criteria`;

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

--
-- Dumping data for table `evaluation_criteria`
--


-- --------------------------------------------------------

--
-- Table structure for table `evaluations`
--

DROP TABLE IF EXISTS `evaluations`;

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

--
-- Dumping data for table `evaluations`
--


-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;

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

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `title`, `message`, `type`, `is_read`, `vendor_id`, `recipient`, `created_at`) VALUES
('N-179032306709973', 'Supply status updated', 'Pacific Fresh Distributors Inc. (SC-DLV-2026-0338) moved to For Receiving.', 'info', 1, 'VND-2026-0001', 'all', '2026-09-25 15:57:00');

-- --------------------------------------------------------

--
-- Table structure for table `receipt_items`
--

DROP TABLE IF EXISTS `receipt_items`;

CREATE TABLE `receipt_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `receipt_id` varchar(40) NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `qty` decimal(12,3) NOT NULL,
  `total_received_quantity` decimal(12,3) DEFAULT NULL,
  `unit` varchar(20) NOT NULL,
  `condition_value` varchar(20) NOT NULL DEFAULT 'good',
  PRIMARY KEY (`id`),
  KEY `idx_ri_receipt_product` (`receipt_id`,`product_name`,`unit`),
  CONSTRAINT `fk_ri_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `receipts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_ri_qty` CHECK (`qty` > 0),
  CONSTRAINT `chk_ri_total` CHECK (`total_received_quantity` is null or `total_received_quantity` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `receipt_items`
--

INSERT INTO `receipt_items` (`id`, `receipt_id`, `product_name`, `qty`, `total_received_quantity`, `unit`, `condition_value`) VALUES
(1, 'RR-2026-0081', 'Korean BB Cream SPF 50+', '200.000', '200.000', 'pcs', 'good'),
(2, 'RR-2026-0081', 'Hyaluronic Acid Serum 30ml', '120.000', '120.000', 'pcs', 'good'),
(3, 'RR-2026-0078', 'Canned Sardines 155g', '1500.000', '1500.000', 'pcs', 'good'),
(4, 'RR-2026-0075', 'Matte Lipstick Trio', '120.000', '120.000', 'pcs', 'good'),
(5, 'RR-2026-0072', 'Frozen Shrimp Vannamei (HLSO)', '150.000', '150.000', 'kg', 'rejected'),
(6, 'RR-2026-0085', 'Canned Sardines 155g', '50.000', '100.000', 'pcs', 'good'),
(7, 'RR-2026-0085', 'Canned Sardines 155g', '50.000', '100.000', 'pcs', 'damaged');

-- --------------------------------------------------------

--
-- Table structure for table `receipts`
--

DROP TABLE IF EXISTS `receipts`;

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
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_receipts_arrival` (`arrival_id`),
  KEY `idx_receipts_supplier` (`supplier_id`),
  KEY `idx_receipts_status` (`status`),
  KEY `idx_receipts_vendor` (`vendor_id`),
  CONSTRAINT `fk_receipt_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_receipt_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `chk_receipts_total` CHECK (`total_qty` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `receipts`
--

INSERT INTO `receipts` (`id`, `arrival_id`, `supplier_id`, `supplier_name`, `status`, `total_qty`, `received_at`, `receiving_by`, `doc_ref`, `remarks`, `vendor_id`, `created_at`) VALUES
('RR-2026-0072', 'SC-DLV-2026-0272', 'SUP-2026-10045', 'Pacific Fresh Distributors Inc.', 'confirmed', '150.000', '2026-09-21 14:00:00', 'J. Mercado', 'DR-2026-5859', 'Rejected — cold chain broken in transit, product temperature above acceptable range.', 'VND-2026-0001', '2026-09-25 14:17:37'),
('RR-2026-0075', 'SC-DLV-2026-0287', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', 'confirmed', '120.000', '2026-09-23 11:00:00', 'K. Banag', 'DR-2026-5866', 'Count and condition verified, pending final confirmation.', 'VND-2026-0001', '2026-09-25 14:17:37'),
('RR-2026-0078', 'SC-DLV-2026-0298', 'SUP-2026-10032', 'Pacific Dry Goods Trading', 'confirmed', '1500.000', '2026-09-22 14:00:00', 'R. Dela Cruz', 'DR-2026-5871', 'Received 1500 of 2000 pcs; balance pending.', 'VND-2026-0001', '2026-09-25 14:17:37'),
('RR-2026-0081', 'SC-DLV-2026-0311', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', 'confirmed', '320.000', '2026-09-24 14:00:00', 'R. Dela Cruz', 'DR-2026-5881', 'Completed receiving; forwarded to inventory.', 'VND-2026-0001', '2026-09-25 14:17:37'),
('RR-2026-0085', 'SC-DLV-2026-0298', 'SUP-2026-10032', 'Pacific Dry Goods Trading', 'confirmed', '100.000', '2026-09-25 11:00:00', 'R. Dela Cruz', 'DR-2026-5887', '50 units found damaged during receiving inspection.', 'VND-2026-0001', '2026-09-25 14:17:37');

-- --------------------------------------------------------

--
-- Table structure for table `revoked_tokens`
--

DROP TABLE IF EXISTS `revoked_tokens`;

CREATE TABLE `revoked_tokens` (
  `jti` varchar(64) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`jti`),
  KEY `idx_revoked_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `revoked_tokens`
--

INSERT INTO `revoked_tokens` (`jti`, `user_id`, `expires_at`, `revoked_at`) VALUES
('bcd36d0b-67ac-4750-af9a-41666e7205bd', 1, '2026-09-26 02:22:00', '2026-09-25 15:22:42');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;

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

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`jti`, `user_id`, `vendor_id`, `last_seen`, `expires_at`, `created_at`) VALUES
('03bcc58f-6067-4bd4-9e23-e0c41233e834', 2, 'VND-2026-0001', '2026-09-25 16:37:51', '2026-09-25 17:07:51', '2026-09-25 16:37:51'),
('10136d3e-bbf7-49f9-8896-2d9b03814ddf', 2, 'VND-2026-0001', '2026-09-25 15:52:40', '2026-09-25 16:22:40', '2026-09-25 15:52:40'),
('14160550-7ab4-4236-9607-ecced10361e3', 1, 'VND-2026-0001', '2026-09-25 15:23:31', '2026-09-25 15:53:31', '2026-09-25 15:23:30'),
('198e2bec-8ed6-4ff1-8209-c90c09042e01', 2, 'VND-2026-0001', '2026-09-25 15:57:30', '2026-09-25 16:27:30', '2026-09-25 15:57:30'),
('20c34efa-c8a4-49b5-adce-1a419a0896bb', 2, 'VND-2026-0001', '2026-09-25 16:17:37', '2026-09-25 16:47:37', '2026-09-25 16:17:36'),
('267b0622-beb7-4d71-8ebe-2fe34ca4cc1d', 2, 'VND-2026-0001', '2026-09-25 16:17:23', '2026-09-25 16:47:23', '2026-09-25 16:17:23'),
('64221522-7397-4615-b361-cc0bd5e0f722', 1, 'VND-2026-0001', '2026-09-25 16:22:28', '2026-09-25 16:52:28', '2026-09-25 16:22:28'),
('72581dab-738b-477f-b119-4ef3424226bc', 2, 'VND-2026-0001', '2026-09-25 15:52:28', '2026-09-25 16:22:28', '2026-09-25 15:52:28'),
('72ef5216-5d33-4995-afe6-b3b4c9ba6fba', 2, 'VND-2026-0001', '2026-09-25 16:29:56', '2026-09-25 16:59:56', '2026-09-25 16:29:56'),
('7a61122d-bd7b-4fec-a3d7-a2fe16b90721', 2, 'VND-2026-0001', '2026-09-25 16:40:11', '2026-09-25 17:10:11', '2026-09-25 16:40:11'),
('7d360d2d-bcbe-4c8e-9628-1e866826bd16', 2, 'VND-2026-0001', '2026-09-25 15:57:55', '2026-09-25 16:27:55', '2026-09-25 15:57:55'),
('842b93ed-d64a-4611-80c1-8b47ef44e640', 1, 'VND-2026-0001', '2026-09-25 16:40:11', '2026-09-25 17:10:11', '2026-09-25 16:40:10'),
('8b54e8b5-157f-46ae-a7e2-8eecae8abfa2', 1, 'VND-2026-0001', '2026-09-25 16:37:51', '2026-09-25 17:07:51', '2026-09-25 16:37:51'),
('8fd7f9ce-06ba-4623-a539-ba968e02e0fa', 1, 'VND-2026-0001', '2026-09-25 16:39:35', '2026-09-25 17:09:35', '2026-09-25 16:39:35'),
('a1f9a90d-c250-4d28-aecd-56a57087ea45', 1, 'VND-2026-0001', '2026-09-25 14:47:23', '2026-09-25 15:17:23', '2026-09-25 14:47:23'),
('a2d8d702-8f09-4cfc-bea6-9fff2a32781a', 1, 'VND-2026-0001', '2026-09-25 16:29:56', '2026-09-25 16:59:56', '2026-09-25 16:29:56'),
('aa46823e-4132-4c3b-a498-15e046328988', 2, 'VND-2026-0001', '2026-09-25 15:57:47', '2026-09-25 16:27:47', '2026-09-25 15:57:46'),
('c99107b8-2932-4153-81ea-4c02074f8311', 1, 'VND-2026-0001', '2026-09-25 15:52:28', '2026-09-25 16:22:28', '2026-09-25 15:52:28'),
('c9bb02dc-66e3-4daf-92aa-47f60ca50dae', 2, 'VND-2026-0001', '2026-09-25 16:22:28', '2026-09-25 16:52:28', '2026-09-25 16:22:28'),
('cd5d89f0-3df9-4019-b174-b3603c7e89b2', 1, 'VND-2026-0001', '2026-09-25 16:45:40', '2026-09-25 17:15:40', '2026-09-25 15:37:29'),
('d3def803-d010-4891-906a-33acf8d0fbab', 1, 'VND-2026-0001', '2026-09-25 15:52:40', '2026-09-25 16:22:40', '2026-09-25 15:52:40'),
('e5b195c1-6b7a-4b97-9547-8afc2197acb7', 1, 'VND-2026-0001', '2026-09-25 16:17:23', '2026-09-25 16:47:23', '2026-09-25 16:17:23'),
('fe703ad9-8e7a-42ec-bb13-1272cdd051a7', 2, 'VND-2026-0001', '2026-09-25 15:23:31', '2026-09-25 15:53:31', '2026-09-25 15:23:30');

-- --------------------------------------------------------

--
-- Table structure for table `supplier_applications`
--

DROP TABLE IF EXISTS `supplier_applications`;

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

--
-- Dumping data for table `supplier_applications`
--


-- --------------------------------------------------------

--
-- Table structure for table `supplier_products`
--

DROP TABLE IF EXISTS `supplier_products`;

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

--
-- Dumping data for table `supplier_products`
--

INSERT INTO `supplier_products` (`id`, `supplier_id`, `name`, `description`, `brand`, `category`) VALUES
(1, 'SUP-2026-10001', 'Korean BB Cream SPF 50+', 'Multi-function BB cream with sun protection and moisturizing formula.', 'GlowKor', 'Cosmetic Products'),
(2, 'SUP-2026-10001', 'Hyaluronic Acid Serum 30ml', '2% HA serum with panthenol and ceramide complex for intense hydration.', 'GlowKor', 'Cosmetic Products'),
(3, 'SUP-2026-10001', 'Matte Lipstick Trio', 'Long-wear matte lipstick set in three shades.', 'GlowKor', 'Cosmetic Products'),
(4, 'SUP-2026-10032', 'Premium Jasmine Rice 25kg', 'Premium long-grain jasmine rice in sealed 25kg sacks.', 'Pacific Dry', 'Dry Products'),
(5, 'SUP-2026-10032', 'Canned Sardines 155g', 'Canned sardines in tomato sauce, 155g.', 'Pacific Dry', 'Dry Products'),
(6, 'SUP-2026-10045', 'Premium Frozen Tilapia Fillet', 'Grade A frozen tilapia fillets, IQF processed, sizes 100–200g.', 'Pacific Fresh', 'Frozen Products'),
(7, 'SUP-2026-10045', 'Frozen Shrimp Vannamei (HLSO)', 'Head-less shell-on frozen shrimp, various count sizes available.', 'Pacific Fresh', 'Frozen Products');

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;

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

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `source_ref`, `source_application_id`, `company_name`, `contact_name`, `contact_email`, `contact_phone`, `supplier_type`, `address`, `email`, `phone`, `website`, `distribution_area`, `status`, `evaluation_score`, `performance_rating`, `last_evaluated`, `vendor_id`, `established_on`, `created_at`) VALUES
('SUP-2026-10001', 'SCSUP-2026-0140', NULL, 'BeautyPH Cosmetics Inc.', 'Ana Reyes', 'a.reyes@beautyphcosmetics.com', '+63 920 543 2109', 'Importer', '78 Shaw Blvd, Mandaluyong City, Metro Manila', 'sales@beautyphcosmetics.com', '+63 2 6666 3333', 'www.beautyphcosmetics.com', 'Metro Manila, Cebu, Davao', 'active', NULL, NULL, NULL, 'VND-2026-0001', '2026-06-17', '2026-09-25 14:17:37'),
('SUP-2026-10032', 'SCSUP-2026-0131', NULL, 'Pacific Dry Goods Trading', 'Marco Santos', 'marco@pacificdry.ph', '+63 917 812 3456', 'Wholesaler', '12 Harbor Drive, Port Area, Manila', 'marco@pacificdry.ph', '+63 2 8888 1111', 'www.pacificdry.ph', 'Metro Manila, Luzon', 'active', NULL, NULL, NULL, 'VND-2026-0001', '2026-07-07', '2026-09-25 14:17:37'),
('SUP-2026-10045', 'SCSUP-2026-0156', NULL, 'Pacific Fresh Distributors Inc.', 'Maria Santos', 'maria.santos@pacificfresh.ph', '+63 917 123 4567', 'Distributor', '45 Macapagal Blvd, Pasay City, Metro Manila', 'info@pacificfresh.ph', '+63 2 8888 5555', 'www.pacificfresh.ph', 'Metro Manila, Luzon', 'active', NULL, NULL, NULL, 'VND-2026-0001', '2026-08-11', '2026-09-25 14:17:37');

-- --------------------------------------------------------

--
-- Table structure for table `supply_request_items`
--

DROP TABLE IF EXISTS `supply_request_items`;

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

--
-- Dumping data for table `supply_request_items`
--

INSERT INTO `supply_request_items` (`id`, `request_id`, `product_id`, `product_name`, `quantity`, `unit`, `remarks`, `created_at`, `updated_at`) VALUES
(1, 'VR-2026-0001', 4, 'Premium Jasmine Rice 25kg', '100.000', 'sack', '', '2026-09-25 14:17:37', '2026-09-25 14:17:37'),
(2, 'VR-2026-0002', 5, 'Canned Sardines 155g', '500.000', 'pcs', '', '2026-09-25 14:17:37', '2026-09-25 14:17:37'),
(3, 'VR-2026-0003', 5, 'Canned Sardines 155g', '2000.000', 'pcs', '', '2026-09-25 14:17:37', '2026-09-25 14:17:37'),
(4, 'VR-2026-0004', 3, 'Matte Lipstick Trio', '120.000', 'pcs', '', '2026-09-25 14:17:37', '2026-09-25 14:17:37');

-- --------------------------------------------------------

--
-- Table structure for table `supply_requests`
--

DROP TABLE IF EXISTS `supply_requests`;

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

--
-- Dumping data for table `supply_requests`
--

INSERT INTO `supply_requests` (`id`, `requested_by`, `request_date`, `needed_by_date`, `priority`, `reason`, `remarks`, `status`, `submitted_at`, `sc_reference`, `processing_status`, `supplier_id`, `supplier_name`, `expected_delivery_date`, `vendor_id`, `created_at`, `updated_at`) VALUES
('VR-2026-0001', 1, '2026-09-24 09:00:00', '2026-09-29', 'normal', 'Advance stock-up of staple rice ahead of scheduled operations.', '', 'draft', NULL, '', '', NULL, '', NULL, 'VND-2026-0001', '2026-09-25 14:17:37', '2026-09-25 14:17:37'),
('VR-2026-0002', 1, '2026-09-24 11:00:00', '2026-09-27', 'high', 'Sustained institutional demand; maintain buffer stock of canned goods.', 'Preferred single-brand; source as coordinated by Supply Chain.', 'under_review', '2026-09-24 12:00:00', 'SC-REQ-2026-0299', '', NULL, '', NULL, 'VND-2026-0001', '2026-09-25 14:17:37', '2026-09-25 14:17:37'),
('VR-2026-0003', 1, '2026-09-20 09:00:00', '2026-09-26', 'normal', 'Periodic bulk procurement of canned goods for retail operations.', '', 'fulfillment_in_progress', '2026-09-21 09:00:00', 'SC-REQ-2026-0298', '', 'SUP-2026-10032', 'Pacific Dry Goods Trading', '2026-09-26', 'VND-2026-0001', '2026-09-25 14:17:37', '2026-09-25 14:17:37'),
('VR-2026-0004', 1, '2026-09-19 09:00:00', '2026-09-24', 'low', 'Replenish cosmetic counter inventory for the upcoming launch promotion.', '', 'fulfilled', '2026-09-20 09:00:00', 'SC-REQ-2026-0287', '', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', '2026-09-23', 'VND-2026-0001', '2026-09-25 14:17:37', '2026-09-25 14:17:37');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;

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

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `display_name`, `role`, `vendor_id`, `created_at`) VALUES
(1, 'admin', '$2b$10$W6wwvUleYPPICJ7ttrKyxuTJcEQ9zLCvymp9VEvpSfMq3foUd5pxO', 'Administrator', 'admin', 'VND-2026-0001', '2026-09-25 14:17:37'),
(2, 'staff', '$2b$10$I4M8DAJGJGgUc6vCLhgpl.WqkkXXHj70UJRODN8Ux82P8jCWLOCyC', 'Receiving Staff', 'receiving_staff', 'VND-2026-0001', '2026-09-25 14:47:06');

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;

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

--
-- Dumping data for table `vendors`
--

INSERT INTO `vendors` (`id`, `company_name`, `contact_name`, `contact_email`, `contact_phone`, `address`, `is_active`, `created_at`, `updated_at`) VALUES
('VND-2026-0001', 'Tri-M Global Logistics & Trading Inc.', 'Warehouse Supervisor', 'info.tmglt@gmail.com', '+63 2 5555 0100', 'Blk. 1A Lot 14, Verde Heights Subd., Brgy. Gaya-Gaya, City of San Jose del Monte, Bulacan', 1, '2026-09-25 14:17:37', '2026-09-25 14:17:37');

SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;