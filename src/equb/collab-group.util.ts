import { CollabRole, EqubMember } from './entities/equb-member.entity';

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

export function groupLabel(members: { user: { fullName: string } }[]): string {
  const names = members.map((m) => m.user.fullName.split(' ')[0]);
  return `Group: ${names.join(' & ')}`;
}
