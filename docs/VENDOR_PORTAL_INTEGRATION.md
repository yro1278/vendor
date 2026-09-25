# Tri-M Vendor Portal — Database Integration Map

Restores the supplier **sourcing** flows (public application, application status,
admin review, evaluation, performance monitoring, audit logs) as fully
**MySQL-backed** features that sit **alongside** the existing receiving &
monitoring subsystem. No business data is hardcoded in the frontend; nothing is
stored in `localStorage` except the authenticated session flag.

Look-first rule: all legacy-only UI (data-URL uploads, in-memory lists) was
extracted from git history (`7e0064c`) into `old_App.txt` purely as a design
reference. The implementation below persists every record to the database and
serves the public portal through an unauthenticated API router.

---

## 1. New database tables

| Table                       | Purpose                                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `supplier_applications`     | One row per supplier application (`APP-YYYY-NNNNN`) + status state machine |
| `application_products`      | Products / supplies offered by the applicant (capacity, MOQ, price range) |
| `application_documents`     | Uploaded proof documents (PDF / JPG / PNG, ≤ 10 MB each), stored on disk |
| `application_timeline`      | Timestamped history entries shown on the public Status page              |
| `evaluations`               | One admin evaluation per supplier (`evaluation_criteria` nested rows)    |
| `evaluation_criteria`       | Per-criterion score rows (5 criteria, fixed weights)                     |
| `suppliers` (extended)      | `evaluation_score`, `performance_rating`, `last_evaluated`, `source_application_id` |

Status machine (`status` on `supplier_applications`):

```
pending_review ─► under_review ─► approved        (creates a suppliers row)
       │              │
       │              └──────────► revision_required ─► pending_review (resubmit)
       └─────────────────────────► rejected (with reason)
```

On **approve** the backend:
1. generates `SUP-YYYY-NNNNN`,
2. inserts a `suppliers` row (`source_ref = application id`, `status = active`),
3. copies `application_products` into `supplier_products`,
4. links `approved_supplier_id`, writes timeline + notification + audit entries.

## 2. New API endpoints

### Public (no auth) — mounted at `/api/public`

| Method | Path                              | Multipart | Body (application/x-www-form-urlencoded for status)             |
| ------ | --------------------------------- | --------- | ---------------------------------------------------------------- |
| POST   | `/api/public/applications`        | yes       | form fields + `files[]` (1–5 docs)                                |
| POST   | `/api/public/applications/resubmit`| yes       | `id`, `email` + form fields + `files[]` (only from `revision_required`) |
| GET    | `/api/public/applications/status` | no        | `?id=APP-…&email=…`                                              |

Public status lookup validates that the email matches the application before
returning company info, status, revision/rejection notes, and the timeline.

### Authenticated admin — mounted at `/api/vendor` (behind `requireAuth`)

| Method | Path                                   | Purpose                                        |
| ------ | -------------------------------------- | ---------------------------------------------- |
| GET    | `/api/vendor/applications`             | list applications (also in `/bootstrap`)       |
| GET    | `/api/vendor/applications/:id`         | full detail incl. products, docs, timeline     |
| GET    | `/api/vendor/applications/:id/documents/:docId/download` | download proof doc           |
| POST   | `/api/vendor/applications/:id/under-review` | pending → under review                    |
| POST   | `/api/vendor/applications/:id/approve` | approve; creates supplier record               |
| POST   | `/api/vendor/applications/:id/reject`  | `{ reason }`                                   |
| POST   | `/api/vendor/applications/:id/revision`| `{ note }` → revision_required                  |
| GET    | `/api/vendor/evaluations`              | latest evaluation per supplier                 |
| POST   | `/api/vendor/evaluations`              | `{ supplierId, comment, scores }` — weighted total written to suppliers |
| GET    | `/api/vendor/performance`              | derived metrics from real receiving data       |
| GET    | `/api/vendor/audit-logs`               | full `audit_logs` trail for the vendor account |

## 3. Frontend mapping

| Page                          | Route / flow                     | Source                              |
| ----------------------------- | -------------------------------- | ----------------------------------- |
| Public Home / landing         | pre-login portal                 | `src/app/PublicPortal.tsx`          |
| Become Supplier (apply form)  | pre-login portal                 | `src/app/PublicPortal.tsx`          |
| Apply Success (Save your ID)  | pre-login portal                 | `src/app/PublicPortal.tsx`          |
| Check Application Status      | pre-login portal                 | `src/app/PublicPortal.tsx`          |
| Applications Review (admin)   | new sidebar page                 | `src/app/AdminReview.tsx`           |
| Supplier Evaluation (sliders) | new sidebar page                 | `src/app/AdminReview.tsx`           |
| Performance Monitoring        | new sidebar page                 | `src/app/AdminReview.tsx`           |
| Audit Logs                    | new sidebar page                 | `src/app/AdminReview.tsx`           |
| Existing pages (receiving/monitoring/…) | untouched                | `src/app/VendorModule.tsx`          |

Design tokens are re-used from the current module: `surface`, `btn`, `btn-primary`,
`inp`, `modal-panel`, violet `#5b21b6` accent, `MonoId` IDs.

## 4. Enforcement points

- **Vendor isolation**: every admin read/write passes through
  `vendorIdOf(user)` + `assertVendorScope` (store.js) exactly like the existing
  subsystem.
- **Audit trail**: every write action calls `logAudit` with
  `entityType = application | supplier | evaluation`.
- **Notifications**: submitted / under review / approved / rejected / revision
  each create a `notifications` row for the Tri-M account, surfaced in the
  existing Notifications page and bell.
- **Validation**: server-side field + email regex + file type/size rules
  identical to the legacy form rules (PDF/JPG/PNG, ≤ 10 MB, ≥ 1 product, ≥ 1 doc).
- **Tests**: existing `validate-receipt`, `validate-request`, and
  `api-integration` suites must keep passing (seeded `RR-2026-0085` intact).