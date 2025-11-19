import { pool } from './src/db.js';
import { readFileSync } from 'fs';

async function migrate() {
  try {
    console.log('Running migration: Add family_keys table...');

    const sql = readFileSync('./add-family-keys.sql', 'utf8');
    await pool.query(sql);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
