import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enable connection caching for better performance
neonConfig.fetchConnectionCache = true;

// Create the SQL client with proper configuration
const sql = neon(process.env.DATABASE_URL);

// Initialize Drizzle with the HTTP client
export const db = drizzle(sql);

// Export the configured database instance
export { sql };