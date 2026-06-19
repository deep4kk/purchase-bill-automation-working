# 1. OBJECTIVE

Migrate the purchase bill automation system from PostgreSQL to MongoDB and add default sorting (newest to oldest based on last updated) across all list pages.

# 2. CONTEXT SUMMARY

**Current Stack:**
- **Backend:** Express.js API server with TypeScript (`/api-server`)
- **Frontend:** React invoice app with TanStack Query (`/invoice-app`)
- **Database:** PostgreSQL via Drizzle ORM (referenced as `@workspace/db` workspace package)
- **Auth:** JWT-based authentication with bcrypt password hashing

**Database Tables (8 total):**
1. `users` - User accounts with roles (admin, accounts, purchase_manager, auditor)
2. `invoices` - Uploaded invoice files with extracted data
3. `suppliers` - Supplier master list synced with ERP
4. `items` - Item catalog synced with ERP
5. `gstr2b_records` - Imported GSTR-2B data
6. `reconciliation_records` - Matching results between ERP and GSTR-2B
7. `erp_connections` - ERP integration settings
8. `audit_logs` - System activity logs

**Pages with List Data (8 total):**
1. `/invoices` - Invoice list with status filter
2. `/suppliers` - Supplier list with search
3. `/items` - Items master list with search
4. `/audit-logs` - Audit log list with action filter
5. `/gstr2b` - GSTR-2B records with search
6. `/reconciliation` - Reconciliation records with period/status filter
7. `/users` - User management list
8. Dashboard - Summary stats

**Current Sorting:**
- Most endpoints use `.orderBy(createdAt)` ascending (oldest first)
- Need to change to descending (newest first) by default and add sort controls

# 3. APPROACH OVERVIEW

**Database Migration Strategy:**
1. Replace Drizzle ORM with MongoDB native driver (mongodb npm package)
2. Convert SQL-based schemas to MongoDB document schemas
3. Replace all Drizzle query builders with MongoDB find/sort/aggregate operations
4. Handle key differences:
   - No auto-increment IDs → Use MongoDB ObjectId
   - No table joins → Use separate collections with referenced IDs
   - Flexible schema → Define document structure for consistency

**Sorting Enhancement:**
1. Add `updatedAt` timestamp field to track modifications
2. Update all list endpoints to support sort field and direction parameters
3. Default to sorting by `updatedAt` descending (newest first)
4. Add sort UI controls in frontend tables

**Recommended Additional Features:**
- Export functionality (CSV/Excel) for all list pages
- Bulk delete operations
- Column visibility toggles
- Advanced filters (date range pickers)
- Refresh buttons for live data

# 4. IMPLEMENTATION STEPS

## Phase 1: Database Setup & Migration

### Step 1.1: Install MongoDB Dependencies
- **Goal:** Add MongoDB driver to api-server
- **Method:** Add `mongodb` package to api-server/package.json
- **Reference:** `api-server/package.json`

### Step 1.2: Create MongoDB Connection Module
- **Goal:** Establish MongoDB connection pool
- **Method:** Create `src/lib/mongodb.ts` with:
  - MongoClient connection with connection string from env
  - Database instance export
  - Connection health check
- **Reference:** New file `api-server/src/lib/mongodb.ts`

### Step 1.3: Define MongoDB Collections/Schemas
- **Goal:** Define document schemas matching current table structures
- **Method:** Create `src/lib/schemas.ts` with TypeScript interfaces for:
  - User, Invoice, Supplier, Item, Gstr2bRecord, ReconciliationRecord, ErpConnection, AuditLog
  - Include `createdAt` and `updatedAt` timestamps
- **Reference:** New file `api-server/src/lib/schemas.ts`

### Step 1.4: Create Data Access Layer (DAL)
- **Goal:** Replace Drizzle queries with MongoDB operations
- **Method:** Create `src/lib/dal.ts` with CRUD functions for each entity:
  - `findUsers()`, `findUserById()`, `createUser()`, `updateUser()`
  - `findInvoices()`, `findInvoiceById()`, `createInvoice()`, `updateInvoice()`
  - Similar functions for all 8 entities
  - Include sorting, pagination, filtering support
- **Reference:** New file `api-server/src/lib/dal.ts`

## Phase 2: Backend Route Updates

### Step 2.1: Update Auth Routes
- **Goal:** Migrate auth routes to MongoDB
- **Method:** Update `src/routes/auth.ts`:
  - Replace Drizzle `db.select().from(usersTable)` with `dal.findUsers()`
  - Replace `db.insert()` with `dal.createUser()`
  - Replace `db.update()` with `dal.updateUser()`
  - Remove Drizzle imports, add MongoDB imports
- **Reference:** `api-server/src/routes/auth.ts`

### Step 2.2: Update Invoice Routes
- **Goal:** Migrate invoice routes with sorting support
- **Method:** Update `src/routes/invoices.ts`:
  - Replace all Drizzle queries with DAL functions
  - Add sort parameter support (default: `updatedAt: -1`)
  - Update formatInvoice() to include updatedAt
- **Reference:** `api-server/src/routes/invoices.ts`

### Step 2.3: Update Supplier Routes
- **Goal:** Migrate supplier routes with sorting
- **Method:** Update `src/routes/suppliers.ts`:
  - Replace Drizzle queries with DAL functions
  - Add sorting support (default: `updatedAt: -1`)
- **Reference:** `api-server/src/routes/suppliers.ts`

### Step 2.4: Update Item Routes
- **Goal:** Migrate item routes with sorting
- **Method:** Update `src/routes/items.ts`:
  - Replace Drizzle queries with DAL functions
  - Add sorting support
- **Reference:** `api-server/src/routes/items.ts`

### Step 2.5: Update Audit Log Routes
- **Goal:** Migrate audit log routes with sorting
- **Method:** Update `src/routes/audit.ts`:
  - Replace Drizzle queries with DAL functions
  - Add sorting support (default: `createdAt: -1`)
- **Reference:** `api-server/src/routes/audit.ts`

### Step 2.6: Update GSTR-2B Routes
- **Goal:** Migrate GSTR-2B routes with sorting
- **Method:** Update `src/routes/gstr2b.ts`:
  - Replace Drizzle queries with DAL functions
  - Add sorting support
- **Reference:** `api-server/src/routes/gstr2b.ts`

### Step 2.7: Update Reconciliation Routes
- **Goal:** Migrate reconciliation routes with sorting
- **Method:** Update `src/routes/reconciliation.ts`:
  - Replace Drizzle queries with DAL functions
  - Add sorting support
- **Reference:** `api-server/src/routes/reconciliation.ts`

### Step 2.8: Update ERP Routes
- **Goal:** Migrate ERP settings routes
- **Method:** Update `src/routes/erp.ts`:
  - Replace Drizzle queries with DAL functions
  - Handle MongoDB-specific onConflictDoUpdate syntax
- **Reference:** `api-server/src/routes/erp.ts`

## Phase 3: Frontend Updates

### Step 3.1: Update API Client Types
- **Goal:** Update generated API types for new endpoints
- **Method:** Update types to include sorting parameters
- **Reference:** `@workspace/api-client-react` (external package)

### Step 3.2: Add Sort Controls to Invoice List
- **Goal:** Add column header click sorting
- **Method:** Update `src/pages/invoices/index.tsx`:
  - Add sort field state
  - Add sort direction state
  - Add click handlers to table headers
  - Show sort indicator icons
- **Reference:** `invoice-app/src/pages/invoices/index.tsx`

### Step 3.3: Add Sort Controls to Supplier List
- **Goal:** Add sorting to supplier table
- **Method:** Similar updates as Step 3.2
- **Reference:** `invoice-app/src/pages/suppliers/index.tsx`

### Step 3.4: Add Sort Controls to Items List
- **Goal:** Add sorting to items table
- **Method:** Similar updates as Step 3.2
- **Reference:** `invoice-app/src/pages/items/index.tsx`

### Step 3.5: Add Sort Controls to Audit Log List
- **Goal:** Add sorting to audit log table
- **Method:** Similar updates as Step 3.2
- **Reference:** `invoice-app/src/pages/audit-logs/index.tsx`

### Step 3.6: Add Sort Controls to GSTR-2B List
- **Goal:** Add sorting to GSTR-2B table
- **Method:** Similar updates as Step 3.2
- **Reference:** `invoice-app/src/pages/gstr2b/index.tsx`

### Step 3.7: Add Sort Controls to Reconciliation List
- **Goal:** Add sorting to reconciliation table
- **Method:** Similar updates as Step 3.2
- **Reference:** `invoice-app/src/pages/reconciliation/index.tsx`

## Phase 4: Cleanup & Optimization

### Step 4.1: Remove Drizzle Dependencies
- **Goal:** Clean up unused Drizzle ORM code
- **Method:** Remove drizzle-orm from package.json dependencies
- **Reference:** `api-server/package.json`

### Step 4.2: Add MongoDB Indexes
- **Goal:** Optimize query performance
- **Method:** Create indexes on frequently queried fields:
  - `invoices.updatedAt`, `invoices.status`, `invoices.supplierName`
  - `suppliers.updatedAt`, `suppliers.name`
  - `items.updatedAt`, `items.name`
  - `auditLogs.createdAt`, `auditLogs.action`
- **Reference:** `api-server/src/lib/dal.ts`

### Step 4.3: Update Environment Variables
- **Goal:** Add MongoDB connection string env var
- **Method:** Update `.env` example with `MONGODB_URI`
- **Reference:** Create `api-server/.env.example`

# 5. TESTING AND VALIDATION

## Manual Testing Checklist

### Database Connection
- [ ] Server starts and connects to MongoDB successfully
- [ ] Connection errors are handled gracefully
- [ ] Connection pool is reused across requests

### Auth Flow
- [ ] User registration works and creates document in MongoDB
- [ ] Login works with correct credentials
- [ ] Password reset flow works

### Invoice Management
- [ ] Upload invoice creates document with createdAt/updatedAt
- [ ] List invoices returns sorted by updatedAt descending
- [ ] Clicking column header changes sort order
- [ ] Update invoice updates updatedAt timestamp
- [ ] Delete invoice removes document

### Supplier Management
- [ ] Create supplier works
- [ ] List suppliers sorted by updatedAt descending
- [ ] Search filters work correctly
- [ ] Update updates updatedAt

### Items Management
- [ ] Create/update items works
- [ ] List items sorted by updatedAt descending
- [ ] Search filters work

### Audit Logs
- [ ] Logs are created for all actions
- [ ] List logs sorted by createdAt descending
- [ ] Filter by action works

### GSTR-2B & Reconciliation
- [ ] Import GSTR-2B creates records
- [ ] Run reconciliation creates reconciliation records
- [ ] Lists sorted correctly
- [ ] Period filter works

### Users Page
- [ ] List users works
- [ ] Role update works
- [ ] Sorting works

## Expected API Response Format

```json
// GET /api/invoices?page=1&limit=20&sortBy=updatedAt&sortOrder=desc
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "sortBy": "updatedAt",
  "sortOrder": "desc"
}
```

## Success Criteria

1. All CRUD operations work with MongoDB
2. All list pages default to sorting by updatedAt descending (newest first)
3. Clicking column headers allows changing sort field and direction
4. No PostgreSQL/Drizzle dependencies remain in api-server
5. Server starts without errors with MONGODB_URI environment variable
