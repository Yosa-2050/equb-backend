import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SwapMembersDto {
  @ApiProperty({ description: 'First equb member id, or any member in a collab group' })
  @IsUUID()
  memberAId!: string;

  @ApiProperty({ description: 'Second equb member id, or any member in a collab group' })
  @IsUUID()
  memberBId!: string;
}
