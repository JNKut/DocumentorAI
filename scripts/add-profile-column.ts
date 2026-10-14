// Adds the settings.profile column (business profile). Safe to run more than
// once. Run against every client database before deploying code that reads it:
//   npm run db:migrate-profile                                (uses .env DATABASE_URL)
//   DATABASE_URL="<other-db-url>" npm run db:migrate-profile
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb`;
  const [row] = await sql`
    SELECT data_type, column_default FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'profile'`;
  console.log(`settings.profile: ${row.data_type}, default ${row.column_default}`);
}

main().then(
  () => process.exit(0),
  err => {
    console.error(err);
    process.exit(1);
  },
);
