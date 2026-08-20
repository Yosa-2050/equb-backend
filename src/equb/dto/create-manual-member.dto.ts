import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateManualMemberDto {
  @ApiProperty({ description: "The member's display name" })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional({ example: '@abebe' })
  @IsString()
  @IsOptional()
  telegramUsername?: string;

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
      "This member's contribution. Omit to use the equb default amount.",
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  contributionAmount?: number;
}
