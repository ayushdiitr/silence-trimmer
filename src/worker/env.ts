/**
 * Environment for worker
 * Load dotenv BEFORE importing env to ensure validation works
 */

import dotenv from "dotenv";

// Load .env file into process.env
dotenv.config();

// Now import and re-export the main env
// Since process.env is populated, validation will succeed
import { env } from "~/env";

export const workerEnv = env;

