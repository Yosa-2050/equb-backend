import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUpdateMemberDto {
  @ApiPropertyOptional({ description: "The member's display name" })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '+251 9xx xxx xxx' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'CBE' })
  @IsString()
  @IsOptional()
  accountProvider?: string;

  @ApiPropertyOptional({ example: '1000xx xxx xxx' })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({ description: 'Name on the bank/mobile-money account' })
  @IsString()
  @IsOptional()
  accountHolderName?: string;

  @ApiPropertyOptional({
    description:
      "This member's monthly contribution. Omit/clear to use the equb default.",
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  contributionAmount?: number;
}
