import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CollabGroupMemberInput {
  @ApiProperty({ description: 'EqubMember id' })
  @IsUUID()
  memberId!: string;

  @ApiProperty({
    example: 500,
    description: "This member's share of one monthly amount",
  })
  @IsNumber()
  @IsPositive()
  contributionAmount!: number;
}

export class CreateCollabGroupDto {
  @ApiPropertyOptional({ example: 'Group A+B' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ type: [CollabGroupMemberInput] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CollabGroupMemberInput)
  members!: CollabGroupMemberInput[];

  @ApiProperty({ description: 'Must be one of the memberIds in `members`' })
  @IsUUID()
  leaderMemberId!: string;
}
