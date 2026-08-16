import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AddMemberDto {
  @ApiPropertyOptional({
    description: 'Existing user id. Provide this OR a fullName.',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Name for a new (manually-added) member when no userId given',
  })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telegramUsername?: string;

  @ApiPropertyOptional({ example: 'Telebirr' })
  @IsString()
  @IsOptional()
  accountProvider?: string;

  @ApiPropertyOptional({ description: 'Name on the bank/mobile-money account' })
  @IsString()
  @IsOptional()
  accountHolderName?: string;

  @ApiPropertyOptional({ example: '1000xx xxx xxx' })
  @IsString()
  @IsOptional()
  accountNumber?: string;
}
