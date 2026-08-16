import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMyMembershipDto {
  @ApiPropertyOptional({ description: 'Your display name' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Telebirr' })
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
      'Your monthly contribution for this equb. Omit/clear to use the equb default.',
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  contributionAmount?: number;
}
