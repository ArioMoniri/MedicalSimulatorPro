import { drizzle } from "drizzle-orm/neon-http";
import { neonConfig, Pool } from "@neondatabase/serverless";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure Neon
neonConfig.fetchConnectionCache = true;

// Create a connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize Drizzle with the pool
export const db = drizzle(pool, { schema });

// Export pool for potential direct usage
export { pool };