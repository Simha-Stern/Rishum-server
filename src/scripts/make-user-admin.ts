import { eq } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { users } from '../db/Schemes/index.js';
import { logger } from '../utils/logger.js';

const email = process.argv[2]?.trim().toLowerCase();

try {
  if (!email) {
    logger.error('Usage: npm run users:make-admin -- <email>');
    process.exitCode = 1;
  } else {
    const [user] = await db
      .update(users)
      .set({ isSystemAdmin: true, updatedAt: new Date() })
      .where(eq(users.email, email))
      .returning({ id: users.id });

    if (!user) {
      logger.error('User is not registered.');
      process.exitCode = 1;
    } else {
      logger.info('User is now a system administrator.');
    }
  }
} catch {
  logger.error('Failed to update the user administrator status.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
