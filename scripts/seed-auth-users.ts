/**
 * 将预置用户写入 Redis：yarn seed:auth
 */
import { seedAuthUsers } from '../db/auth.repository';

async function main() {
  await seedAuthUsers();
  console.log('[seed] auth users written to Redis');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
