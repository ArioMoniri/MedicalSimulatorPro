import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a SQL connection with Neon Serverless driver
const sql = neon(process.env.DATABASE_URL);

// Initialize Drizzle with the connection
export const db = drizzle(sql, { schema });