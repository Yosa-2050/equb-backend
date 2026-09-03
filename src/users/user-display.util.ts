import { User } from './entities/user.entity';

// The name to actually show for a user: their app-specific override if
// they (or an admin) set one, otherwise their Telegram name.
export function displayNameOf(
  user: Pick<User, 'fullName' | 'displayName'> | null | undefined,
): string {
  if (!user) return 'Unknown';
  return user.displayName || user.fullName;
}
