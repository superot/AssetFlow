// ─────────────────────────────────────────────
// Enums  (mirror Prisma schema enums)
// ─────────────────────────────────────────────

export type UserRole = "ADMIN" | "MANAGER" | "USER";

export type CategoryType = "HARDWARE" | "SOFTWARE";

export type AssetStatus = "AVAILABLE" | "DEPLOYED" | "UNDER_REPAIR" | "ARCHIVED";

export type AuditAction =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "ASSIGNED"
  | "RETURNED"
  | "STATUS_CHANGED";

// ─────────────────────────────────────────────
// Base entities
// ─────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  role: UserRole;
  isActive: boolean;
  location: string | null;
  departmentId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  description: string | null;
  createdAt: Date;
}

export interface Asset {
  id: string;
  assetTag: string;
  serialNumber: string | null;
  name: string;
  model: string | null;
  manufacturer: string | null;
  categoryId: string;
  status: AssetStatus;
  purchaseDate: Date | null;
  warrantyExpiry: Date | null;
  purchaseCost: number | null;
  location: string | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface License {
  id: string;
  name: string;
  licenseKey: string | null;
  vendor: string | null;
  categoryId: string;
  totalSeats: number;
  availableSeats: number;
  expirationDate: Date | null;
  isSubscription: boolean;
  purchaseCost: number | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Assignment {
  id: string;
  assetId: string | null;
  licenseId: string | null;
  userId: string;
  assignedBy: string;
  assignedAt: Date;
  returnedAt: Date | null;
  notes: string | null;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  changedBy: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// Relations (extended types)
// ─────────────────────────────────────────────

export interface UserWithDepartment extends User {
  department: Department | null;
  activeAssignmentCount: number;
}

export interface AssetCurrentAssignment {
  id: string;
  user: { name: string | null; email: string };
}

export interface AssetWithRelations extends Asset {
  category: Category;
  assignments: AssignmentWithUser[];
  currentAssignment?: AssetCurrentAssignment | null;
}

export interface LicenseWithRelations extends License {
  category: Category;
  assignments: AssignmentWithUser[];
}

export interface AssignmentWithRelations extends Assignment {
  asset: Asset | null;
  license: License | null;
  user: User;
  createdBy: User;
}

export interface AssignmentWithUser extends Assignment {
  user: User;
  createdBy: User;
}

export interface AuditLogWithUser extends AuditLog {
  user: User;
}

// ─────────────────────────────────────────────
// API utility types
// ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// ─────────────────────────────────────────────
// Form / request input types
// ─────────────────────────────────────────────

export interface CreateAssetInput {
  assetTag: string;
  serialNumber?: string;
  name: string;
  model?: string;
  manufacturer?: string;
  categoryId: string;
  status?: AssetStatus;
  purchaseDate?: string; // ISO date string
  warrantyExpiry?: string;
  purchaseCost?: number;
  location?: string;
  notes?: string;
}

export interface UpdateAssetInput extends Partial<CreateAssetInput> {
  id: string;
}

export interface CreateLicenseInput {
  name: string;
  licenseKey?: string;
  vendor?: string;
  categoryId: string;
  totalSeats: number;
  expirationDate?: string;
  isSubscription?: boolean;
  purchaseCost?: number;
  notes?: string;
}

export interface CreateAssignmentInput {
  assetId?: string;
  licenseId?: string;
  userId: string;
  notes?: string;
}

// ─────────────────────────────────────────────
// Dashboard / reporting types
// ─────────────────────────────────────────────

export interface DashboardStats {
  totalAssets: number;
  deployedAssets: number;
  availableAssets: number;
  assetsUnderRepair: number;
  expiringWarranties: number; // within 30 days
  totalLicenses: number;
  expiringLicenses: number;   // within 30 days
  activeAssignments: number;
}
