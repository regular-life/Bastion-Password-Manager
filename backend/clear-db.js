import { pool } from './src/db.js';

async function clearDatabase() {
  try {
    console.log('Clearing database...');

    // Delete in order to respect foreign key constraints
    await pool.query('DELETE FROM audit_log');
    console.log('✓ Cleared audit_log');

    await pool.query('DELETE FROM fill_tokens');
    console.log('✓ Cleared fill_tokens');

    await pool.query('DELETE FROM shared_credentials');
    console.log('✓ Cleared shared_credentials');

    await pool.query('DELETE FROM family_keys');
    console.log('✓ Cleared family_keys');

    await pool.query('DELETE FROM family_invites');
    console.log('✓ Cleared family_invites');

    await pool.query('DELETE FROM family_members');
    console.log('✓ Cleared family_members');

    await pool.query('DELETE FROM families');
    console.log('✓ Cleared families');

    await pool.query('DELETE FROM vault_entries');
    console.log('✓ Cleared vault_entries');

    await pool.query('DELETE FROM users');
    console.log('✓ Cleared users');

    console.log('\n✅ Database cleared successfully! You can now create fresh accounts.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
}

clearDatabase();
