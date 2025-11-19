import { pool } from './src/db.js';

async function migrate() {
  try {
    console.log('Running migration: Make shared_credentials columns nullable...');

    await pool.query(`
      ALTER TABLE shared_credentials
      ALTER COLUMN encrypted_credential DROP NOT NULL,
      ALTER COLUMN encrypted_credential_nonce DROP NOT NULL,
      ALTER COLUMN encrypted_url DROP NOT NULL,
      ALTER COLUMN encrypted_url_nonce DROP NOT NULL;
    `);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
