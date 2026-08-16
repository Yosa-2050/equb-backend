import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiPropertyOptional({
    example: 1000,
    description: 'Amount paid (defaults to the monthly contribution)',
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Receipt image URL' })
  @IsString()
  @IsOptional()
  receiptImageUrl?: string;
}
