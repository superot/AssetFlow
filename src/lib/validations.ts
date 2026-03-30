import { z } from "zod";

// ─────────────────────────────────────────────
// Asset
// ─────────────────────────────────────────────

export const createAssetSchema = z.object({
  assetTag: z.string().min(1).max(50),
  serialNumber: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  model: z.string().max(150).optional(),
  manufacturer: z.string().max(150).optional(),
  categoryId: z.string().cuid(),
  status: z.enum(["AVAILABLE", "DEPLOYED", "UNDER_REPAIR", "ARCHIVED"]).default("AVAILABLE"),
  purchaseDate: z.string().datetime({ offset: true }).optional().nullable(),
  warrantyExpiry: z.string().datetime({ offset: true }).optional().nullable(),
  purchaseCost: z.number().nonnegative().optional().nullable(),
  location: z.string().max(200).optional(),
  notes: z.string().optional(),
});

export const updateAssetSchema = createAssetSchema.partial().omit({ assetTag: true });

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

// ─────────────────────────────────────────────
// License
// ─────────────────────────────────────────────

export const createLicenseSchema = z.object({
  name: z.string().min(1).max(200),
  licenseKey: z.string().max(500).optional().nullable(),
  vendor: z.string().max(150).optional(),
  categoryId: z.string().cuid(),
  totalSeats: z.number().int().positive().default(1),
  expirationDate: z.string().datetime({ offset: true }).optional().nullable(),
  isSubscription: z.boolean().default(false),
  purchaseCost: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional(),
});

export const updateLicenseSchema = createLicenseSchema.partial();

export type CreateLicenseInput = z.infer<typeof createLicenseSchema>;
export type UpdateLicenseInput = z.infer<typeof updateLicenseSchema>;

// ─────────────────────────────────────────────
// Assignment
// ─────────────────────────────────────────────

export const createAssignmentSchema = z
  .object({
    assetId: z.string().cuid().optional(),
    licenseId: z.string().cuid().optional(),
    userId: z.string().cuid(),
    notes: z.string().optional(),
  })
  .refine((data) => !!(data.assetId ?? data.licenseId), {
    message: "Either assetId or licenseId must be provided",
  })
  .refine((data) => !(data.assetId && data.licenseId), {
    message: "Cannot assign both an asset and a license in one assignment",
  });

export const returnAssignmentSchema = z.object({
  notes: z.string().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type ReturnAssignmentInput = z.infer<typeof returnAssignmentSchema>;

// ─────────────────────────────────────────────
// Category
// ─────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["HARDWARE", "SOFTWARE"]),
  description: z.string().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// ─────────────────────────────────────────────
// User
// ─────────────────────────────────────────────

export const createUserSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email().max(255),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).default("USER"),
  departmentId: z.string().cuid().optional().nullable(),
  password: z.string().min(8).max(72),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    location: z.string().max(100).optional().nullable(),
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ─────────────────────────────────────────────
// Pagination query params
// ─────────────────────────────────────────────

export const paginationSchema = z.object({
  // nullish() handles both null and undefined → applies default
  page: z.coerce.number().int().positive().default(1).nullish().transform((v) => v ?? 1),
  pageSize: z.coerce.number().int().positive().max(100).default(20).nullish().transform((v) => v ?? 20),
  search: z.string().optional().nullable().transform((v) => v ?? undefined),
  status: z.enum(["AVAILABLE", "DEPLOYED", "UNDER_REPAIR", "ARCHIVED"]).optional().nullable().transform((v) => v ?? undefined),
  categoryId: z.string().optional().nullable().transform((v) => v ?? undefined),
  sortBy: z.string().optional().nullable().transform((v) => v ?? undefined),
  sortDir: z.enum(["asc", "desc"]).optional().nullable().transform((v) => v ?? "desc"),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────

export const updateGeneralSettingsSchema = z.object({
  app_name: z.string().min(1).max(100),
  warranty_alert_days: z.coerce.number().int().min(1).max(365),
});
export type UpdateGeneralSettingsInput = z.infer<typeof updateGeneralSettingsSchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const updateEntraIdSchema = z.object({
  entra_tenant_id: z.string().min(1).max(200),
  entra_client_id: z.string().min(1).max(200),
  entra_client_secret: z.string().max(500), // empty string = keep existing
});
export type UpdateEntraIdInput = z.infer<typeof updateEntraIdSchema>;

export const updateNotificationSettingsSchema = z.object({
  notifications_enabled: z.boolean(),
  notification_recipient_email: z.string().email().max(255),
  notification_sender_email: z.string().email().max(255),
  notification_days_before: z.coerce.number().int().min(1).max(365),
});
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
