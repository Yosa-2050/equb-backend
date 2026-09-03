import { CollabRole, EqubMember } from './entities/equb-member.entity';
import { displayNameOf } from '../users/user-display.util';

export interface RoundResolution {
  recipient: EqubMember | null;
  payerMembers: EqubMember[];
  groupMembers: EqubMember[] | null;
}


export function resolveRound(
  memberships: EqubMember[],
  month: number,
): RoundResolution {
  const roundMembers = memberships.filter((m) => m.order === month);
  if (roundMembers.length === 0) {
    return { recipient: null, payerMembers: memberships, groupMembers: null };
  }

  const leader = roundMembers.find((m) => m.collabRole === CollabRole.LEADER);
  const recipient = leader ?? roundMembers[0];
  const isGroup = recipient.collabGroupId != null && roundMembers.length > 1;

  const excludeIds = new Set(roundMembers.map((m) => m.id));
  const payerMembers = memberships.filter((m) => !excludeIds.has(m.id));

  return {
    recipient,
    payerMembers,
    groupMembers: isGroup ? roundMembers : null,
  };
}

export function groupLabel(
  members: { user: { fullName: string; displayName: string | null } }[],
): string {
  const names = members.map((m) => displayNameOf(m.user).split(' ')[0]);
  return `Group: ${names.join(' & ')}`;
}
