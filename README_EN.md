# AssetFlow — IT Asset Management System

AssetFlow is an enterprise-grade IT Asset Management (ITAM) application for centrally managing hardware assets, software licenses, and assignment records.

---

## Screenshots

| Dashboard | Assets |
|-----------|--------|
| ![Dashboard](screenshots/2.png) | ![Assets](screenshots/1.png) |

| Licenses | Assignments |
|----------|-------------|
| ![Licenses](screenshots/3.png) | ![Assignments](screenshots/4.png) |

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Installation](#installation)
3. [Environment Variables](#environment-variables)
4. [Database](#database)
5. [User Roles](#user-roles)
6. [Features](#features)
   - [Dashboard](#dashboard)
   - [Assets](#assets)
   - [Licenses](#licenses)
   - [Assignments](#assignments)
   - [Users](#users)
   - [Reports](#reports)
   - [Settings](#settings)
7. [Import / Export](#import--export)
8. [QR Code](#qr-code)
9. [API Reference](#api-reference)
10. [Database Schema](#database-schema)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| ORM | Prisma v5 |
| Database | MySQL |
| Authentication | NextAuth.js v4 (JWT, Credentials) |
| Data Fetching | TanStack Query v5 |
| Validation | Zod |
| Icons | Lucide React |
| Excel/CSV | SheetJS (xlsx), PapaParse |
| QR Code | react-qr-code |
| Password Hashing | bcryptjs |

---

## Installation

### Prerequisites

- Node.js 18+
- MySQL 8+
- npm / pnpm / yarn

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit the .env file (see table below)

# 3. Create the database and run migrations
npm run db:migrate

# 4. Load seed data (optional)
npm run db:seed

# 5. Start the development server
npm run dev
```

The application runs at `http://localhost:3000` by default.

### Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run db:migrate` | Run migrations |
| `npm run db:push` | Apply schema directly to DB (development) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Load sample data |

---

## Environment Variables

The following variables must be defined in your `.env` file:

```env
# Database
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/assetflow"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate with: openssl rand -base64 32"
```

In-app settings (alert thresholds, notification emails, Entra ID credentials) are managed from the **Settings** page and stored in the `SystemSetting` table.

---

## Database

### Core Model Relationships

```
Department    →  User[]
User          →  Assignment[] (assignee), Assignment[] (created by)
Category      →  Asset[], License[]
Asset         →  Assignment[]
License       →  Assignment[]
Assignment    →  Asset OR License (exactly one, never both)
AuditLog      →  User (who made the change)
SystemSetting →  key/value pairs (application configuration)
```

### Asset Statuses

| Status | Description |
|--------|-------------|
| `AVAILABLE` | Ready to be assigned |
| `DEPLOYED` | Currently assigned to a user |
| `UNDER_REPAIR` | Under maintenance |
| `ARCHIVED` | Decommissioned |

> An asset in `DEPLOYED` status cannot be deleted. The assignment must be returned first.

---

## User Roles

| Role | Access |
|------|--------|
| **ADMIN** | Full access: all pages, settings, audit logs, category management |
| **MANAGER** | Manage assets, licenses, assignments, and users |
| **USER** | View-only access |

Role-based restrictions are enforced at both the API route and page level.

---

## Features

### Dashboard

The home page displays a real-time system overview:

- Total / Deployed / Available / Under-repair asset counts
- Total licenses / Expiring soon counts
- Active assignment count
- Warning banners for assets with warranties expiring soon
- Warning banners for licenses expiring soon

The warning threshold is configurable under **Settings > General** (default: 30 days).

---

### Assets

**Listing & Filtering**
- Search (name, asset tag, serial number)
- Status filter (AVAILABLE / DEPLOYED / UNDER_REPAIR / ARCHIVED)
- Category filter
- Column-based sorting
- Pagination (default: 20 records/page)
- Desktop: table view | Mobile: card grid view

**Asset Record Fields**

| Field | Required | Description |
|-------|----------|-------------|
| Asset Tag | Yes | Unique identifier (e.g. `PC-001`) |
| Serial Number | No | Unique, optional |
| Name | Yes | Descriptive name |
| Model / Manufacturer | No | Hardware details |
| Category | Yes | HARDWARE category |
| Status | Yes | Default: AVAILABLE |
| Purchase Date | No | |
| Warranty Expiry | No | Used by the alert system |
| Cost | No | Decimal number |
| Location | No | Physical location |
| Notes | No | Free text |

**Bulk Actions**
- Change the status of selected assets
- Delete selected assets (non-DEPLOYED only)

**Asset Detail Page** (`/assets/[id]`)
- All field values
- Assignment history (who received it, when, and when it was returned)
- View / download / print QR code

---

### Licenses

**Listing & Filtering**
- Search (name, vendor)
- Seat usage progress bar
- Expiry warning indicator

**License Record Fields**

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | License name |
| License Key | No | |
| Vendor | No | |
| Category | Yes | SOFTWARE category |
| Total Seats | Yes | Default: 1 |
| Expiration Date | No | Used by the alert system |
| Subscription? | No | For renewal tracking |
| Cost | No | |
| Notes | No | |

> When a license is assigned to a user, `availableSeats` decrements automatically; it increments on return.

---

### Assignments

**Creating an Assignment**
- Select an asset **or** a license (not both simultaneously)
- Select a user
- Optionally add a note

**Listing**
- Toggle between active assignments and full history
- Search by user name, asset or license name
- Type filter (asset / license)
- Duration is calculated and displayed automatically

**Bulk Return**
- Select multiple assignments and return them all at once

**Return Behaviour**
- On return, the asset status reverts to `AVAILABLE`
- The license seat is freed
- An audit log entry is created

---

### Users

**User Record Fields**

| Field | Required |
|-------|----------|
| Full Name | Yes |
| Email | Yes (unique) |
| Password | Yes (min. 8 characters) |
| Role | Yes (ADMIN / MANAGER / USER) |
| Department | No |

**Bulk Actions**
- Activate / deactivate selected users
- Assign a department to selected users

**User Detail**
- List of active assignments
- Last login timestamp
- Active / inactive status

> Users with active assignments cannot be deleted.

---

### Reports

All exports are available in **Excel (.xlsx)** or **CSV** format:

| Report | Contents |
|--------|----------|
| Asset Report | All assets (status, category, warranty info) |
| License Report | All licenses (seat usage, expiration) |
| Active Assignments | Currently active assignments |
| Full Assignment History | All assignments including returned ones |

A snapshot of current statistics is also displayed at the top of the page.

---

### Settings

> Accessible by **ADMIN** role only.

**General**
- Application name
- Warranty alert threshold (in days, default: 30)

**Categories**
- Create / edit / delete HARDWARE and SOFTWARE categories
- Categories in use cannot be deleted

**Audit Logs**
- Full record of all system events (CREATED, UPDATED, DELETED, ASSIGNED, RETURNED, STATUS_CHANGED)
- Filter by entity type and action
- IP address and user agent are recorded

**Entra ID**
- Tenant and client credentials for Azure AD / Microsoft Entra ID integration

**Notifications**
- Enable / disable email notifications
- Notification recipient and sender addresses
- How many days before expiry notifications are sent

---

## Import / Export

### Bulk Import

**Supported formats:** `.xlsx`, `.csv`

**Template download:** A pre-filled Excel template can be downloaded from the import dialog on each page.

| Page | Endpoint | Template |
|------|----------|----------|
| Assets | `POST /api/assets/import` | `GET /api/templates/assets` |
| Licenses | `POST /api/licenses/import` | `GET /api/templates/licenses` |

**Import behaviour:**
- Records with a duplicate asset tag are skipped automatically
- Category names are resolved to IDs automatically
- A per-row error report is returned: `{created, skipped, skippedTags, validationErrors}`

### Bulk Export

Active filters on the asset and assignment list pages are reflected in the exported file.

---

## QR Code

A QR code can be generated for any asset:

1. Click the QR icon on the asset list
2. Or click **View QR Code** on the asset detail page

**Options:**
- **Download PNG** — High-resolution PNG generated via canvas
- **Print** — Opens the browser print dialog

The QR code encodes the direct URL to the asset detail page.

---

## API Reference

All API routes are under `/api/`. Session-protected routes are authenticated via NextAuth JWT.

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List (search, status, categoryId, page, pageSize, sortBy, sortDir) |
| POST | `/api/assets` | Create |
| GET | `/api/assets/:id` | Detail + assignment history |
| PUT | `/api/assets/:id` | Update |
| DELETE | `/api/assets/:id` | Soft-delete (blocked if DEPLOYED) |
| POST | `/api/assets/import` | Bulk import (multipart/form-data) |
| GET | `/api/assets/export` | Export (format: xlsx\|csv) |
| PATCH | `/api/assets/bulk` | Bulk status change |
| DELETE | `/api/assets/bulk` | Bulk delete |

### Licenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/licenses` | List |
| POST | `/api/licenses` | Create |
| GET | `/api/licenses/:id` | Detail + active assignments |
| PUT | `/api/licenses/:id` | Update |
| DELETE | `/api/licenses/:id` | Delete (blocked if assignments exist) |
| POST | `/api/licenses/import` | Bulk import |

### Assignments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assignments` | List (userId, active, type, search) |
| POST | `/api/assignments` | Create assignment |
| GET | `/api/assignments/:id` | Detail |
| PATCH | `/api/assignments/:id` | Return assignment |
| PATCH | `/api/assignments/bulk-return` | Bulk return |
| GET | `/api/assignments/export` | Export |
| GET | `/api/assignments/stats` | Quick statistics |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List (type: HARDWARE\|SOFTWARE) |
| POST | `/api/categories` | Create (ADMIN) |
| PATCH | `/api/categories/:id` | Update (ADMIN) |
| DELETE | `/api/categories/:id` | Delete (ADMIN, only if unused) |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List (search, departmentId, status) |
| POST | `/api/users` | Create |
| GET | `/api/users/:id` | Detail + active assignments |
| PATCH | `/api/users/:id` | Update |
| DELETE | `/api/users` | Bulk delete |
| PATCH | `/api/users/bulk` | Bulk activate / deactivate / assign department |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Aggregated statistics |
| GET | `/api/departments` | Department list |
| GET | `/api/reports/assets` | Download asset report |
| GET | `/api/reports/licenses` | Download license report |
| GET | `/api/reports/assignments` | Download assignment report |
| GET | `/api/templates/assets` | Download import template |
| GET | `/api/templates/licenses` | Download import template |
| GET | `/api/settings/general` | Read general settings (ADMIN) |
| PUT | `/api/settings/general` | Save general settings (ADMIN) |
| GET | `/api/settings/audit-logs` | Audit logs (ADMIN) |

---

## Database Schema

```
Department
  id, name (unique), description, createdAt, updatedAt
  → users[]

User
  id, name, email (unique), password (bcrypt), role, isActive
  departmentId?, location?, lastLoginAt?, createdAt, updatedAt
  → assignments[], assignmentsCreated[], auditLogs[]

Category
  id, name (unique), type (HARDWARE|SOFTWARE), description, createdAt
  → assets[], licenses[]

Asset
  id, assetTag (unique), serialNumber? (unique), name, model?, manufacturer?
  categoryId, status, purchaseDate?, warrantyExpiry?, purchaseCost?
  location?, notes?, deletedAt? (soft-delete), createdAt, updatedAt
  → assignments[]

License
  id, name, licenseKey?, vendor?, categoryId
  totalSeats, availableSeats, expirationDate?, isSubscription
  purchaseCost?, notes?, deletedAt? (soft-delete), createdAt, updatedAt
  → assignments[]

Assignment
  id, assetId? XOR licenseId?, userId, assignedBy
  assignedAt, returnedAt?, notes?
  → asset, license, user, createdBy

AuditLog
  id, entityType, entityId, action, changedBy
  oldValue? (JSON), newValue? (JSON), ipAddress?, userAgent?, createdAt

SystemSetting
  key (PK), value, updatedAt
```

---

*AssetFlow — Enterprise IT Asset Management*
