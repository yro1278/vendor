-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 20, 2026 at 02:32 PM
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
-- Database: `tri_m_vendor`
--

-- --------------------------------------------------------

--
-- Table structure for table `arrivals`
--

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
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `supply_request_id` varchar(40) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'expected',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `arrivals`
--

INSERT INTO `arrivals` (`id`, `source_ref`, `supplier_id`, `supplier_name`, `total_qty`, `expected_date`, `expected_time`, `destination`, `remarks`, `vendor_id`, `supply_request_id`, `status`, `created_at`) VALUES
('SC-DLV-2026-0272', 'SC-SCHED-2026-0272', 'SUP-2026-10045', 'Pacific Fresh Distributors Inc.', 150, '2026-09-16', '7:30 AM', 'Tri-M MDC — Cold Storage', 'Cold chain broke in transit; returned to supplier; replacement scheduled.', 'VND-2026-0001', NULL, 'rejected_damaged', '2026-09-15 05:00:00'),
('SC-DLV-2026-0287', 'SC-SCHED-2026-0287', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', 120, '2026-09-18', '11:00 AM', 'Tri-M MDC — Warehouse A', 'Physical count verified.', 'VND-2026-0001', 'VR-2026-0004', 'received', '2026-09-17 05:00:00'),
('SC-DLV-2026-0298', 'SC-SCHED-2026-0298', 'SUP-2026-10032', 'Pacific Dry Goods Trading', 2000, '2026-09-17', '2:00 PM', 'Tri-M MDC — Warehouse A', 'Balance of 400 pcs pending from supplier.', 'VND-2026-0001', 'VR-2026-0003', 'rejected_damaged', '2026-09-16 05:00:00'),
('SC-DLV-2026-0311', 'SC-SCHED-2026-0311', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', 320, '2026-09-19', '10:00 AM', 'Tri-M MDC — Warehouse A', '', 'VND-2026-0001', NULL, 'completed', '2026-09-14 05:00:00'),
('SC-DLV-2026-0334', 'SC-SCHED-2026-0334', 'SUP-2026-10032', 'Pacific Dry Goods Trading', 100, '2026-09-20', '9:00 AM', 'Tri-M MDC — Warehouse A', 'Delivery truck arrived at site.', 'VND-2026-0001', NULL, 'for_receiving', '2026-09-18 05:00:00'),
('SC-DLV-2026-0338', 'SC-SCHED-2026-0338', 'SUP-2026-10045', 'Pacific Fresh Distributors Inc.', 500, '2026-09-21', '8:30 AM', 'Tri-M MDC — Cold Storage', '', 'VND-2026-0001', NULL, 'expected', '2026-09-19 05:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `arrival_items`
--

CREATE TABLE `arrival_items` (
  `id` int(11) NOT NULL,
  `arrival_id` varchar(40) NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `qty` int(11) NOT NULL,
  `unit` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `vendor_id` varchar(40) DEFAULT NULL,
  `action` varchar(60) NOT NULL,
  `entity_type` varchar(60) NOT NULL DEFAULT '',
  `entity_id` varchar(100) NOT NULL DEFAULT '',
  `detail` varchar(1000) NOT NULL DEFAULT '',
  `ip` varchar(64) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `user_id`, `vendor_id`, `action`, `entity_type`, `entity_id`, `detail`, `ip`, `created_at`) VALUES
(1, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-20 12:17:56'),
(2, 1, 'VND-2026-0001', 'login', 'session', '', 'Administrator signed in.', '::1', '2026-09-20 12:21:15');

-- --------------------------------------------------------

--
-- Table structure for table `company_documents`
--

CREATE TABLE `company_documents` (
  `id` varchar(64) NOT NULL,
  `vendor_id` varchar(40) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `mime_type` varchar(120) NOT NULL,
  `size_bytes` int(11) NOT NULL,
  `uploaded_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` varchar(40) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` varchar(500) NOT NULL DEFAULT '',
  `type` varchar(20) NOT NULL DEFAULT 'info',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `receipts`
--

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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `receipts`
--

INSERT INTO `receipts` (`id`, `arrival_id`, `supplier_id`, `supplier_name`, `status`, `total_qty`, `received_at`, `receiving_by`, `doc_ref`, `remarks`, `vendor_id`, `created_at`) VALUES
('RR-2026-0072', 'SC-DLV-2026-0272', 'SUP-2026-10045', 'Pacific Fresh Distributors Inc.', 'confirmed', 150.000, '2026-09-16 14:00:00', 'J. Mercado', 'DR-2026-5859', 'Rejected — cold chain broken in transit, product temperature above acceptable range.', 'VND-2026-0001', '2026-09-20 10:45:11'),
('RR-2026-0075', 'SC-DLV-2026-0287', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', 'confirmed', 120.000, '2026-09-18 11:00:00', 'K. Banag', 'DR-2026-5866', 'Count and condition verified, pending final confirmation.', 'VND-2026-0001', '2026-09-20 10:45:11'),
('RR-2026-0078', 'SC-DLV-2026-0298', 'SUP-2026-10032', 'Pacific Dry Goods Trading', 'confirmed', 1500.000, '2026-09-17 14:00:00', 'R. Dela Cruz', 'DR-2026-5871', 'Received 1500 of 2000 pcs; balance pending.', 'VND-2026-0001', '2026-09-20 10:45:11'),
('RR-2026-0081', 'SC-DLV-2026-0311', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', 'confirmed', 320.000, '2026-09-19 14:00:00', 'R. Dela Cruz', 'DR-2026-5881', 'Completed receiving; forwarded to inventory.', 'VND-2026-0001', '2026-09-20 10:45:11'),
('RR-2026-0085', 'SC-DLV-2026-0298', 'SUP-2026-10032', 'Pacific Dry Goods Trading', 'confirmed', 100.000, '2026-09-20 11:00:00', 'R. Dela Cruz', 'DR-2026-5887', '50 units found damaged during receiving inspection.', 'VND-2026-0001', '2026-09-20 10:45:11');

-- --------------------------------------------------------

--
-- Table structure for table `receipt_items`
--

CREATE TABLE `receipt_items` (
  `id` int(11) NOT NULL,
  `receipt_id` varchar(40) NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `qty` decimal(12,3) NOT NULL,
  `total_received_quantity` decimal(12,3) DEFAULT NULL,
  `unit` varchar(20) NOT NULL,
  `condition_value` varchar(20) NOT NULL DEFAULT 'good'
) ;

--
-- Dumping data for table `receipt_items`
--

INSERT INTO `receipt_items` (`id`, `receipt_id`, `product_name`, `qty`, `total_received_quantity`, `unit`, `condition_value`) VALUES
(1, 'RR-2026-0081', 'Korean BB Cream SPF 50+', 200.000, 200.000, 'pcs', 'good'),
(2, 'RR-2026-0081', 'Hyaluronic Acid Serum 30ml', 120.000, 120.000, 'pcs', 'good'),
(3, 'RR-2026-0078', 'Canned Sardines 155g', 1500.000, 1500.000, 'pcs', 'good'),
(4, 'RR-2026-0075', 'Matte Lipstick Trio', 120.000, 120.000, 'pcs', 'good'),
(5, 'RR-2026-0072', 'Frozen Shrimp Vannamei (HLSO)', 150.000, 150.000, 'kg', 'rejected'),
(6, 'RR-2026-0085', 'Canned Sardines 155g', 50.000, 100.000, 'pcs', 'good'),
(7, 'RR-2026-0085', 'Canned Sardines 155g', 50.000, 100.000, 'pcs', 'damaged');

-- --------------------------------------------------------

--
-- Table structure for table `revoked_tokens`
--

CREATE TABLE `revoked_tokens` (
  `jti` varchar(64) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` varchar(30) NOT NULL,
  `source_ref` varchar(40) NOT NULL,
  `vendor_id` varchar(40) NOT NULL DEFAULT '',
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
  `established_on` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `source_ref`, `vendor_id`, `company_name`, `contact_name`, `contact_email`, `contact_phone`, `supplier_type`, `address`, `email`, `phone`, `website`, `distribution_area`, `status`, `established_on`, `created_at`) VALUES
('SUP-2026-10001', 'SCSUP-2026-0140', 'VND-2026-0001', 'BeautyPH Cosmetics Inc.', 'Ana Reyes', 'a.reyes@beautyphcosmetics.com', '+63 920 543 2109', 'Importer', '78 Shaw Blvd, Mandaluyong City, Metro Manila', 'sales@beautyphcosmetics.com', '+63 2 6666 3333', 'www.beautyphcosmetics.com', 'Metro Manila, Cebu, Davao', 'active', '2026-06-12', '2026-09-20 10:45:11'),
('SUP-2026-10032', 'SCSUP-2026-0131', 'VND-2026-0001', 'Pacific Dry Goods Trading', 'Marco Santos', 'marco@pacificdry.ph', '+63 917 812 3456', 'Wholesaler', '12 Harbor Drive, Port Area, Manila', 'marco@pacificdry.ph', '+63 2 8888 1111', 'www.pacificdry.ph', 'Metro Manila, Luzon', 'active', '2026-07-02', '2026-09-20 10:45:11'),
('SUP-2026-10045', 'SCSUP-2026-0156', 'VND-2026-0001', 'Pacific Fresh Distributors Inc.', 'Maria Santos', 'maria.santos@pacificfresh.ph', '+63 917 123 4567', 'Distributor', '45 Macapagal Blvd, Pasay City, Metro Manila', 'info@pacificfresh.ph', '+63 2 8888 5555', 'www.pacificfresh.ph', 'Metro Manila, Luzon', 'active', '2026-08-06', '2026-09-20 10:45:11');

-- --------------------------------------------------------

--
-- Table structure for table `supplier_products`
--

CREATE TABLE `supplier_products` (
  `id` int(11) NOT NULL,
  `supplier_id` varchar(30) NOT NULL,
  `name` varchar(180) NOT NULL,
  `description` varchar(500) NOT NULL DEFAULT '',
  `brand` varchar(160) NOT NULL DEFAULT '',
  `category` varchar(60) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
-- Table structure for table `supply_requests`
--

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
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `supply_requests`
--

INSERT INTO `supply_requests` (`id`, `requested_by`, `request_date`, `needed_by_date`, `priority`, `reason`, `remarks`, `status`, `submitted_at`, `sc_reference`, `processing_status`, `supplier_id`, `supplier_name`, `expected_delivery_date`, `vendor_id`, `created_at`, `updated_at`) VALUES
('VR-2026-0001', 1, '2026-09-19 09:00:00', '2026-09-24', 'normal', 'Advance stock-up of staple rice ahead of scheduled operations.', '', 'draft', NULL, '', '', NULL, '', NULL, 'VND-2026-0001', '2026-09-20 11:28:59', '2026-09-20 12:10:00'),
('VR-2026-0002', 1, '2026-09-19 11:00:00', '2026-09-22', 'high', 'Sustained institutional demand; maintain buffer stock of canned goods.', 'Preferred single-brand; source as coordinated by Supply Chain.', 'under_review', '2026-09-19 12:00:00', 'SC-REQ-2026-0299', '', NULL, '', NULL, 'VND-2026-0001', '2026-09-20 11:28:59', '2026-09-20 12:10:00'),
('VR-2026-0003', 1, '2026-09-15 09:00:00', '2026-09-21', 'normal', 'Periodic bulk procurement of canned goods for retail operations.', '', 'fulfillment_in_progress', '2026-09-16 09:00:00', 'SC-REQ-2026-0298', '', 'SUP-2026-10032', 'Pacific Dry Goods Trading', '2026-09-21', 'VND-2026-0001', '2026-09-20 11:28:59', '2026-09-20 12:10:00'),
('VR-2026-0004', 1, '2026-09-14 09:00:00', '2026-09-19', 'low', 'Replenish cosmetic counter inventory for the upcoming launch promotion.', '', 'fulfilled', '2026-09-15 09:00:00', 'SC-REQ-2026-0287', '', 'SUP-2026-10001', 'BeautyPH Cosmetics Inc.', '2026-09-18', 'VND-2026-0001', '2026-09-20 11:28:59', '2026-09-20 12:10:00');

-- --------------------------------------------------------

--
-- Table structure for table `supply_request_items`
--

CREATE TABLE `supply_request_items` (
  `id` int(11) NOT NULL,
  `request_id` varchar(40) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `product_name` varchar(180) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `remarks` varchar(500) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

--
-- Dumping data for table `supply_request_items`
--

INSERT INTO `supply_request_items` (`id`, `request_id`, `product_id`, `product_name`, `quantity`, `unit`, `remarks`, `created_at`, `updated_at`) VALUES
(1, 'VR-2026-0001', 4, 'Premium Jasmine Rice 25kg', 100.000, 'sack', '', '2026-09-20 11:28:59', '2026-09-20 11:28:59'),
(2, 'VR-2026-0002', 5, 'Canned Sardines 155g', 500.000, 'pcs', '', '2026-09-20 11:28:59', '2026-09-20 11:28:59'),
(3, 'VR-2026-0003', 5, 'Canned Sardines 155g', 2000.000, 'pcs', '', '2026-09-20 11:28:59', '2026-09-20 11:28:59'),
(4, 'VR-2026-0004', 3, 'Matte Lipstick Trio', 120.000, 'pcs', '', '2026-09-20 11:28:59', '2026-09-20 11:28:59');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(100) NOT NULL DEFAULT '',
  `role` varchar(50) NOT NULL DEFAULT 'admin',
  `vendor_id` varchar(40) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `display_name`, `role`, `vendor_id`, `created_at`) VALUES
(1, 'admin', '$2b$10$UQTqt5IeXQmio6Gn.i0Yme1hpmngHTaioYs1Zqk9.FU/GSe3XXBZG', 'Administrator', 'admin', 'VND-2026-0001', '2026-09-20 10:45:11');

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `id` varchar(40) NOT NULL,
  `company_name` varchar(180) NOT NULL,
  `contact_name` varchar(120) NOT NULL DEFAULT '',
  `contact_email` varchar(160) NOT NULL DEFAULT '',
  `contact_phone` varchar(60) NOT NULL DEFAULT '',
  `address` varchar(255) NOT NULL DEFAULT '',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `vendors`
--

INSERT INTO `vendors` (`id`, `company_name`, `contact_name`, `contact_email`, `contact_phone`, `address`, `is_active`, `created_at`, `updated_at`) VALUES
('VND-2026-0001', 'Tri-M Global Logistics & Trading Inc.', 'Warehouse Supervisor', 'info.tmglt@gmail.com', '+63 2 5555 0100', 'Blk. 1A Lot 14, Verde Heights Subd., Brgy. Gaya-Gaya, City of San Jose del Monte, Bulacan', 1, '2026-09-20 12:09:29', '2026-09-20 12:19:39');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `arrivals`
--
ALTER TABLE `arrivals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_arrivals_status` (`status`),
  ADD KEY `fk_arrival_supplier` (`supplier_id`),
  ADD KEY `idx_arrivals_supply_request` (`supply_request_id`),
  ADD KEY `idx_arrivals_vendor` (`vendor_id`);

--
-- Indexes for table `arrival_items`
--
ALTER TABLE `arrival_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ai_arrival` (`arrival_id`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_audit_vendor_time` (`vendor_id`,`created_at`),
  ADD KEY `idx_audit_user` (`user_id`);

--
-- Indexes for table `company_documents`
--
ALTER TABLE `company_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cd_vendor` (`vendor_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_read` (`is_read`),
  ADD KEY `idx_notifications_vendor` (`vendor_id`);

--
-- Indexes for table `receipts`
--
ALTER TABLE `receipts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_receipts_arrival` (`arrival_id`),
  ADD KEY `idx_receipts_supplier` (`supplier_id`),
  ADD KEY `idx_receipts_status` (`status`),
  ADD KEY `idx_receipts_vendor` (`vendor_id`);

--
-- Indexes for table `receipt_items`
--
ALTER TABLE `receipt_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ri_receipt_product` (`receipt_id`,`product_name`,`unit`);

--
-- Indexes for table `revoked_tokens`
--
ALTER TABLE `revoked_tokens`
  ADD PRIMARY KEY (`jti`),
  ADD KEY `idx_revoked_expiry` (`expires_at`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `source_ref` (`source_ref`),
  ADD KEY `idx_suppliers_status` (`status`),
  ADD KEY `idx_suppliers_vendor` (`vendor_id`);

--
-- Indexes for table `supplier_products`
--
ALTER TABLE `supplier_products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sp_supplier` (`supplier_id`);

--
-- Indexes for table `supply_requests`
--
ALTER TABLE `supply_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_req_status` (`status`),
  ADD KEY `idx_req_requested_by` (`requested_by`),
  ADD KEY `idx_req_supplier` (`supplier_id`),
  ADD KEY `idx_req_vendor` (`vendor_id`);

--
-- Indexes for table `supply_request_items`
--
ALTER TABLE `supply_request_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sri_request_product` (`request_id`,`product_id`),
  ADD KEY `fk_sri_product` (`product_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_users_vendor` (`vendor_id`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `arrival_items`
--
ALTER TABLE `arrival_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `receipt_items`
--
ALTER TABLE `receipt_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `supplier_products`
--
ALTER TABLE `supplier_products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `supply_request_items`
--
ALTER TABLE `supply_request_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `arrivals`
--
ALTER TABLE `arrivals`
  ADD CONSTRAINT `fk_arrival_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  ADD CONSTRAINT `fk_arrival_supply_request` FOREIGN KEY (`supply_request_id`) REFERENCES `supply_requests` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `arrival_items`
--
ALTER TABLE `arrival_items`
  ADD CONSTRAINT `fk_ai_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `company_documents`
--
ALTER TABLE `company_documents`
  ADD CONSTRAINT `fk_cd_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `receipts`
--
ALTER TABLE `receipts`
  ADD CONSTRAINT `fk_receipt_arrival` FOREIGN KEY (`arrival_id`) REFERENCES `arrivals` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_receipt_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`);

--
-- Constraints for table `receipt_items`
--
ALTER TABLE `receipt_items`
  ADD CONSTRAINT `fk_ri_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `receipts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `supplier_products`
--
ALTER TABLE `supplier_products`
  ADD CONSTRAINT `fk_sp_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `supply_requests`
--
ALTER TABLE `supply_requests`
  ADD CONSTRAINT `fk_sr_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sr_user` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `supply_request_items`
--
ALTER TABLE `supply_request_items`
  ADD CONSTRAINT `fk_sri_product` FOREIGN KEY (`product_id`) REFERENCES `supplier_products` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sri_request` FOREIGN KEY (`request_id`) REFERENCES `supply_requests` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
