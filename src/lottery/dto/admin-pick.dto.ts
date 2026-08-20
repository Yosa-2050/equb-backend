import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AdminPickDto {
  @ApiProperty({
    description:
      'Equb member id to assign to month 1. If this member belongs to a collab group, the whole group is assigned.',
  })
  @IsUUID()
  memberId!: string;
}
