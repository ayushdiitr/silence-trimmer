import { sql } from "drizzle-orm";
import { index, pgEnum, pgTableCreator } from "drizzle-orm/pg-core";

/**
 * Multi-project schema feature of Drizzle ORM
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `assignment_${name}`);

// Enums
export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "member",
]);
export const videoJobStatusEnum = pgEnum("video_job_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
]);

// Users table
export const users = createTable(
  "user",
  (d) => ({
    id: d
      .text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: d.varchar({ length: 255 }).notNull().unique(),
    name: d.varchar({ length: 255 }),
    image: d.text(),
    googleId: d.varchar({ length: 255 }).unique(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    index("user_email_idx").on(t.email),
    index("user_google_id_idx").on(t.googleId),
  ],
);

// Workspaces table
export const workspaces = createTable(
  "workspace",
  (d) => ({
    id: d
      .text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: d.varchar({ length: 255 }).notNull(),
    slug: d.varchar({ length: 255 }).notNull().unique(),
    logoUrl: d.text(),
    primaryColor: d.varchar({ length: 7 }).default("#7c3aed"), // Default purple
    customDomain: d.varchar({ length: 255 }).unique(),
    credits: d.integer().notNull().default(1),
    ownerId: d
      .text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    index("workspace_slug_idx").on(t.slug),
    index("workspace_custom_domain_idx").on(t.customDomain),
    index("workspace_owner_idx").on(t.ownerId),
  ],
);

// Memberships table (join table for users and workspaces)
export const memberships = createTable(
  "membership",
  (d) => ({
    id: d
      .text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: d
      .text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: membershipRoleEnum().notNull().default("member"),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    index("membership_user_idx").on(t.userId),
    index("membership_workspace_idx").on(t.workspaceId),
    index("membership_user_workspace_idx").on(t.userId, t.workspaceId),
  ],
);

// Video Jobs table
export const videoJobs = createTable(
  "video_job",
  (d) => ({
    id: d
      .text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: d
      .text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: d
      .text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: videoJobStatusEnum().notNull().default("queued"),
    inputFileKey: d.text().notNull(),
    outputFileKey: d.text(),
    originalFilename: d.varchar({ length: 255 }).notNull(),
    fileSize: d.integer(), // in bytes
    duration: d.integer(), // in seconds
    error: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    completedAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [
    index("video_job_workspace_idx").on(t.workspaceId),
    index("video_job_user_idx").on(t.userId),
    index("video_job_status_idx").on(t.status),
    index("video_job_created_idx").on(t.createdAt),
  ],
);

// Payments table
export const payments = createTable(
  "payment",
  (d) => ({
    id: d
      .text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: d
      .text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    stripeSessionId: d.varchar({ length: 255 }).notNull().unique(),
    amount: d.integer().notNull(), // in cents
    creditsAdded: d.integer().notNull(),
    status: paymentStatusEnum().notNull().default("pending"),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    index("payment_workspace_idx").on(t.workspaceId),
    index("payment_stripe_session_idx").on(t.stripeSessionId),
  ],
);
